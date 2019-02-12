export class IpfsService {

    RETRIES = 3;
    constructor(private ipfsApi: any) {

    }

    async getSize(newHash: string): Promise<number> {
        console.log(`${(new Date()).toString()} - Create Pin called for hash: ${newHash}`);
        console.log(`${(new Date()).toString()} - IPFS LS calling for hash: ${newHash}`);
        const files = await this.ipfsApi.ls(newHash);
        console.log(`${(new Date()).toString()} - IPFS LS called for hash: ${newHash}`);
        console.log(files);
        const totalSize = files.map(f => f.size).reduce((acc, cur) => acc + cur);

        return totalSize;
    }

    async getDoppelboden(hash: string): Promise<string> {
        return (await this.findDoppelboden(hash)).hash;
    }
    private async findDoppelboden(hash: string) {
        const ls = await this.ipfsApi.ls(hash);
        const doppelboden = ls.find(f => f.name === ".doppelboden");
        return doppelboden;
    }

    async createPin(newHash: string, retryCounter: number = 0): Promise<boolean> {
        if (newHash.length < 1) return false;
        try {
            console.log(`${(new Date()).toString()} - IPFS PIN for hash: ${newHash}`);
            await this.ipfsApi.pin.add(newHash);
            console.log(`${(new Date()).toString()} - IPFS PIN OK called for hash: ${newHash}`);
            return true;
        } catch (e) {
            console.log(e);
            if (retryCounter < this.RETRIES) {
                return this.createPin(newHash, retryCounter + 1)
            } else {
                console.log(`IPFS PIN FAIL for ${newHash}`);
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