export class IpfsService {

    RETRIES = 3;
    constructor(private ipfsApi: any) {

    }

    async getSize(newHash: string, retryCounter: number = 0): Promise<number> {
        try {
            console.log(`${(new Date()).toString()} - getSize(${newHash})...`);
            const stats = await this.ipfsApi.files.stat(`/ipfs/${newHash}`, {size: true} );
            const size = stats.size;
            console.log(`${(new Date()).toString()} - getSize(${newHash}) -> ${size}`);
            return size;
        } catch (e) {
            console.log(e);
            if (retryCounter < this.RETRIES) {
                console.log(`retrying LS for ${newHash}`);
                return await this.getSize(newHash, retryCounter + 1);
            } else {
                console.log(`getSize(${newHash}) failed after ${this.RETRIES} retries`);
                throw e;
            }
        }
    }

    async getDoppelboden(hash: string): Promise<string> {
        return (await this.findDoppelboden(hash)).hash;
    }
    private async findDoppelboden(hash: string) {
        const ls = await this.ipfsApi.ls(hash);
        const doppelboden = ls.find(f => f.name === ".doppelboden");
        return doppelboden;
    }

    async createPin(newHash: string, recursive: boolean = true, retryCounter: number = 0): Promise<boolean> {
        if (newHash.length < 1) return false;
        try {
            console.log(`${(new Date()).toString()} - IPFS (recursive: ${recursive}) PIN for hash: ${newHash}`);
            await this.ipfsApi.pin.add(newHash, { recursive });
            console.log(`${(new Date()).toString()} - IPFS (recursive: ${recursive}) PIN OK called for hash: ${newHash}`);
            return true;
        } catch (e) {
            console.log(e);
            if (retryCounter < this.RETRIES) {
                console.log(`retrying pinning (recursive: ${recursive}) of ${newHash}`);
                return this.createPin(newHash, recursive, retryCounter + 1)
            } else {
                console.log(`IPFS (recursive: ${recursive}) PIN FAIL for ${newHash}`);
                return false;
            }
        }
    };

    async removePin(hash: string) {
        if (hash.length < 1) return;
        try {
            console.log(`${(new Date()).toString()} - IPFS PIN RM for hash: ${hash}`);
            await this.ipfsApi.pin.rm(hash);
            console.log(`${(new Date()).toString()} - IPFS PIN RM OK for hash: ${hash}`);
        } catch (e) {

        }
    }


}