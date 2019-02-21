import * as path from 'path';
import * as fs from 'fs'

import { BehaviorSubject } from 'rxjs';

export interface Share {
    hash: string;
    oldHash?: string;
    doppelbodenHash?: string;
    block: number;
    pinned: boolean;
}
export interface Pointer {
    pointer: string;
    shares: Share[];
}
export interface Hash {
    hash: string;
    pointer: string;
}
export interface Database {
    pointers: Pointer[];
    hashes: Hash[];
}

export class ShareStore {
    readonly DBPATH: string;
    readonly FILE = 'database.json';
    data: Database;

    public unpinOrders = new BehaviorSubject<{ pointer: string, hash: string, doppelbodenHash?: string }>(null);

    constructor(private basepath: string) {
        this.DBPATH = basepath + path.sep + this.FILE;
        if (!fs.existsSync(basepath)) {
            fs.mkdirSync(basepath, { recursive: true });
        }
        this.recoverData();
    }

    private recoverData() {
        if (fs.existsSync(this.DBPATH)) {
            const fromFs = fs.readFileSync(this.DBPATH);
            this.data = JSON.parse(fromFs.toString());
        } else {
            this.data = { pointers: [], hashes: [] };
            this.writeToFile();
        }
    }

    public shareUpdate(pointer: string, hash: string, block: number, oldHash?: string, doppelbodenHash?: string) {
        let existingPointer = this.data.pointers.find(p => p.pointer === pointer);
        if (!existingPointer) {
            existingPointer = { pointer, shares: [] };
            this.data.pointers.push(existingPointer);
        }
        existingPointer.shares.push({ block, hash, oldHash, pinned: false, doppelbodenHash });

        this.data.hashes.push({ hash, pointer });
    }
    public pinned(pointer: string, hash: string) {
        let existingPointer = this.data.pointers.find(p => p.pointer === pointer);
        if (existingPointer) {
            const share = existingPointer.shares.find(s => s.hash === hash);
            if (share) {
                share.pinned = true;

                // unpin everything older than the current one
                const older = existingPointer.shares.filter(s => s.block < share.block);
                if (older) older.forEach(old => {
                    this.unpinOrders.next({ pointer, hash: old.hash, doppelbodenHash: old.doppelbodenHash });
                });
            }
        }
    }
    public remove(toRemove: { pointer: string, hash: string }) {
        const share = this.data.pointers.find(p => p.pointer === toRemove.pointer);
        if (share) {
            share.shares = share.shares.filter(f => f.hash !== toRemove.hash);
        }
        this.data.hashes = this.data.hashes.filter(f => f.hash !== toRemove.hash);
    }

    public close() {
        this.writeToFile();
    }

    private writeToFile() {
        fs.writeFileSync(this.DBPATH, JSON.stringify(this.data));

    }
}