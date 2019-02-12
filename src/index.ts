import * as ipfsControl from './ipfsControl';
import * as exitHook from 'async-exit-hook';
import { Contract, providers, utils } from 'ethers';
import * as fs from 'fs';
import { promisify } from 'util';
import { StatisticsService } from './statistics.service';
import { PinningConfig, Mode } from './pinningConfig';
import { IpfsService } from './ipfs.service';
import * as express from 'express';
import * as bodyParser from 'body-parser';
import * as path from 'path';
import { ShareStore } from './sharestore';

const homedir = require('os').homedir();
export const SHARUDIR = path.join(homedir, ".sharu-pinning");
const CONFIGFILE = "pinningConfig.json";
const configLocation = path.join(SHARUDIR, CONFIGFILE);

let CHAIN = { url: 'https://e0zfx11zxg-e0gd5nwg7a-rpc.eu-central-1.kaleido.io', user: 'e0y6xlzwmb', password: 'UBQhpvvcq05N5bDEAtRDnBJgS9ebw0diguQ8Y5mc0RY' }
let NETWORK_ID = '1489252584';

const MAX_PIN_SIZE = 1000 * 1000 * 10;

const sharesAbi = require('./assets/Shares.json');
const SHARES_CONTRACT_ADDRESS = sharesAbi.networks[NETWORK_ID].address;
const SHARES_CONTRACT_ABI = sharesAbi.abi;

const singleFilesAbi = require('./assets/SingleFiles.json');
const SINGLE_FILES_CONTRACT_ADDRESS = singleFilesAbi.networks[NETWORK_ID].address;
const SINGLE_FILES_CONTRACT_ABI = singleFilesAbi.abi;



const provider = new providers.JsonRpcProvider(CHAIN);

const configPort = 31337;
const runAsMaster = process.env.SHARUMASTER === "true";

// read from configFile
readConfig().then(() => {
    sharestore = new ShareStore(SHARUDIR);

    if (!runAsMaster) {
        startConfigFrontend();
    }
    console.log("starting in " + SHARUDIR);
    runApplication();
});

async function startConfigFrontend() {

    const configServer = express();

    console.log(__dirname);
    configServer.use(express.static(__dirname + "/config"));
    configServer.use(bodyParser.urlencoded({ extended: true }));
    configServer.use(bodyParser.json());

    configServer.get("/config", (req, res) => {
        res.send(JSON.stringify(myConfig));
    });
    configServer.get("/config/mode", (req, res) => {
        res.send(myConfig.mode + "");
    });
    configServer.get("/config/wallet", (req, res) => {
        res.send(myConfig.wallet);
    });
    configServer.post("/config", (req, res) => {
        myConfig = { mode: req.body.mode, wallet: req.body.wallet };
        fs.writeFileSync(configLocation, JSON.stringify(myConfig));
        res.sendStatus(200);
    });
    configServer.listen(configPort);

}

let ipfsService: IpfsService;
let myConfig: PinningConfig = null;
async function readConfig() {

    const fileExistsPromise = promisify(fs.exists);
    if (await fileExistsPromise(configLocation)) {
        const fromFs = fs.readFileSync(configLocation);
        myConfig = JSON.parse(fromFs.toString());
    } else {
        if (!fs.existsSync(SHARUDIR)) {
            fs.mkdirSync(SHARUDIR, { recursive: true });
        }

        myConfig = { mode: Mode.Personal, wallet: "" };
        const asJson = JSON.stringify(myConfig);
        fs.writeFileSync(configLocation, asJson);
    }
}

async function onKeyAssigned(address, pubKeyHash, event) {
    console.log(`${(new Date()).toString()} - Event CreatePublicKey received for hash: ${pubKeyHash}`);
    if (await ipfsService.createPin(pubKeyHash)) {
        console.log(`${(new Date()).toString()} - PIN OK for pubKey with hash: ${pubKeyHash}`);
    } else {
        console.log(`${(new Date()).toString()} - PIN FAIL for pubKey with hash: ${pubKeyHash}`);
    }
}
async function onSettingsAssigned(owner: string, oldHash: string, newHash: string, event) {

    console.log(`${(new Date()).toString()} - Event SettingsAssigned received for owner: ${owner} with oldHash ${oldHash} to newHash ${newHash}`);
    if (await ipfsService.createPin(newHash)) {
        console.log(`${(new Date()).toString()} - PIN OK for settings with hash ${newHash} for ${owner}`);
    } else {
        console.log(`${(new Date()).toString()} - PIN FAIL for settings with hash ${newHash} for ${owner}`);
    }
    if (oldHash) {
        ipfsService.removePin(oldHash);
    }
}
async function onUpdated(pointer: BigNumber, oldHash: string, newHash, updater, event) {
    const pointerAsHex = pointer.toHexString();
    console.log(`${(new Date()).toString()} - Event UpdatedShare received for pointer: ${pointer}, old hash: ${oldHash} to new hash: ${newHash}, updater: ${updater}`);
    let cacheIt: boolean; // undefined: nichts damit machen, true: komplett speichern, false: nur bis zu einer gewissen sonst sonst doppelboden
    if (same(myConfig.mode, Mode.FullNode) || (same(myConfig.mode, Mode.Personal) && updater === myConfig.wallet)) {
        // pin everything
        cacheIt = true;
    } else if (same(myConfig.mode, Mode.HalfNode) || runAsMaster) {
        // pin if small enough, otherwise only doppelboden
        cacheIt = false;
        const size = await ipfsService.getSize(newHash);
        if (size < MAX_PIN_SIZE) {
            cacheIt = true;
        } else {
            console.log("share is too big to cache (size: " + size + ")");
        }
    } else {
        // don't pin it
        return;
    }

    if (newHash) {
        let success : boolean;
        let doppelbodenHash: string = null;

        if (cacheIt) {
            doppelbodenHash = await ipfsService.getDoppelboden(newHash);
        }

        sharestore.shareUpdate(pointerAsHex, newHash, event.blockNumber, oldHash, doppelbodenHash);
        if (cacheIt) {
            success = await ipfsService.createPin(newHash);
        } else {
            success = await ipfsService.createPin(doppelbodenHash);
        }

        if (success) {
            sharestore.pinned(pointerAsHex, newHash);
            console.log(`${(new Date()).toString()} - Updated old hash: ${oldHash} to new hash: ${newHash}`);
        } else {
            console.log(`${(new Date()).toString()} - Error while updating old hash: ${oldHash} to new hash: ${newHash}`);
        }
    }
}

export let sharestore: ShareStore;
async function runApplication() {
    console.log("starting application");


    const sharesContractInstance = new Contract(SHARES_CONTRACT_ADDRESS, SHARES_CONTRACT_ABI, provider);
    const singleFilesContractInstance = new Contract(SINGLE_FILES_CONTRACT_ADDRESS, SINGLE_FILES_CONTRACT_ABI, provider)

    ipfsControl.init({runAsMaster, ipfsAllowCircuitRelay: myConfig.ipfsAllowCircuitRelay}).then(async ipfsApi => {
        ipfsService = new IpfsService(ipfsApi);

        singleFilesContractInstance.on('KeyAssigned', async (address, pubKeyHash, event) => {
            onKeyAssigned(address, pubKeyHash, event);
        });

        singleFilesContractInstance.on('SettingsAssigned', async (owner: string, oldHash: string, newHash: string, event) => {
            onSettingsAssigned(owner, oldHash, newHash, event);
        });

        sharesContractInstance.on('Updated', async (pointer, oldHash, newHash, updater, event) => {
            onUpdated(pointer, oldHash, newHash, updater, event);
        });

        sharestore.unpinOrders.subscribe(unpinOrder => {
            if (unpinOrder) {
                if (unpinOrder.doppelbodenHash) {
                    Promise.race([
                        ipfsService.removePin(unpinOrder.doppelbodenHash),
                        ipfsService.removePin(unpinOrder.hash)
                    ]).then(() => sharestore.remove(unpinOrder));
                } else {
                    ipfsService.removePin(unpinOrder.hash).then(() => sharestore.remove(unpinOrder));
                }
            }
        });
    });

    if (runAsMaster) {
        console.log("starting as master");
        new StatisticsService(sharesContractInstance, singleFilesContractInstance);
    }
}




function same(a: Mode, b: Mode) {
    return (a.valueOf() - b.valueOf()) === 0;
}

exitHook(async (callback) => {
    console.log('exiting');
    await ipfsControl.stop();
    console.log('IPFS stopped');
    await sharestore.close();
    console.log('database closed');
    callback();
});



