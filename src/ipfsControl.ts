import * as IPFSFactory from 'ipfsd-ctl';
import { promisify } from 'util';
import * as assert from 'assert';
import * as path from 'path';
import { SHARUDIR } from './index';
import * as fs from 'fs';

let ipfsd = null;

const stdConfig = {
    "Addresses": {
        "Swarm": [
            "/ip4/0.0.0.0/tcp/4004",
            "/ip4/127.0.0.1/tcp/4005/ws",
            "/ip6/::/tcp/4004",
        ],
        "API": "/ip4/127.0.0.1/tcp/5004",
        "Gateway": "/ip4/127.0.0.1/tcp/8380",
    },
    "Bootstrap": [
        '/ip4/104.236.176.52/tcp/4001/ipfs/QmSoLnSGccFuZQJzRadHn95W2CrSFmZuTdDWP8HXaHca9z',
        '/ip4/104.131.131.82/tcp/4001/ipfs/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ',
        '/ip4/104.236.179.241/tcp/4001/ipfs/QmSoLPppuBtQSGwKDZT2M73ULpjvfd3aZ6ha4oFGL1KrGM',
        '/ip4/162.243.248.213/tcp/4001/ipfs/QmSoLueR4xBeUbY9WZ9xGUUxunbKWcrNFTDAadQJmocnWm',
        '/ip4/128.199.219.111/tcp/4001/ipfs/QmSoLSafTMBsPKadTEgaXctDQVcqN88CNLHXMkTNwMKPnu',
        '/ip4/104.236.76.40/tcp/4001/ipfs/QmSoLV4Bbm51jM9C4gDYZQ9Cy3U6aXMJDAbzgu2fzaDs64',
        '/ip4/178.62.158.247/tcp/4001/ipfs/QmSoLer265NRgSp2LA3dPaeykiS1J6DifTC88f5uVQKNAd',
        '/ip4/178.62.61.185/tcp/4001/ipfs/QmSoLMeWqB7YGVLJN3pNLQpmmEk35v6wYtsMGLzSr5QBU3',
        '/ip4/104.236.151.122/tcp/4001/ipfs/QmSoLju6m7xTh3DuokvT3886QRYqxAzb1kShaanJgW36yx',
        '/ip6/2604:a880:1:20::1f9:9001/tcp/4001/ipfs/QmSoLnSGccFuZQJzRadHn95W2CrSFmZuTdDWP8HXaHca9z',
        '/ip6/2604:a880:1:20::203:d001/tcp/4001/ipfs/QmSoLPppuBtQSGwKDZT2M73ULpjvfd3aZ6ha4oFGL1KrGM',
        '/ip6/2604:a880:0:1010::23:d001/tcp/4001/ipfs/QmSoLueR4xBeUbY9WZ9xGUUxunbKWcrNFTDAadQJmocnWm',
        '/ip6/2400:6180:0:d0::151:6001/tcp/4001/ipfs/QmSoLSafTMBsPKadTEgaXctDQVcqN88CNLHXMkTNwMKPnu',
        '/ip6/2604:a880:800:10::4a:5001/tcp/4001/ipfs/QmSoLV4Bbm51jM9C4gDYZQ9Cy3U6aXMJDAbzgu2fzaDs64',
        '/ip6/2a03:b0c0:0:1010::23:1001/tcp/4001/ipfs/QmSoLer265NRgSp2LA3dPaeykiS1J6DifTC88f5uVQKNAd',
        '/ip6/2a03:b0c0:1:d0::e7:1/tcp/4001/ipfs/QmSoLMeWqB7YGVLJN3pNLQpmmEk35v6wYtsMGLzSr5QBU3',
        '/ip6/2604:a880:1:20::1d9:6001/tcp/4001/ipfs/QmSoLju6m7xTh3DuokvT3886QRYqxAzb1kShaanJgW36yx',
        '/dns4/node0.preload.ipfs.io/tcp/443/wss/ipfs/QmZMxNdpMkewiVZLMRxaNxUeZpDUb34pWjZ1kZvsd16Zic',
        '/dns4/node1.preload.ipfs.io/tcp/443/wss/ipfs/Qmbut9Ywz9YEDrz8ySBSgWyJk41Uvm2QJPhwDJzJyGFsD6'
    ],
    "API": {
        "HTTPHeaders":
        {
            "Access-Control-Allow-Credentials": [
                "true"
            ],
            "Access-Control-Allow-Methods": [
                "PUT", "POST", "GET"
            ],
            "Access-Control-Allow-Origin": [
                "*"
            ]
        }
    },
    "relay": {
        "enabled": false,
        "hop": {
            "enabled": false
        }
    }
};
const bootStrapForNodes = [
    '/ip4/159.89.6.248/tcp/4001/ipfs/Qme1rMSWymeMZKaLMuXWEAXz7YXXwiWfnwc3UiSA95yGQ1',
    '/ip4/213.165.80.135/tcp/4001/ipfs/QmXPiBKHQ31s33n6F9cUWYjdGSFs5nAzxBPoq6NqnrR1uj'
];

export async function init(configuration : {
        runAsMaster: boolean, 
        ipfsAllowCircuitRelay?: boolean
    }) {
    try {
        const IPFSDIR = SHARUDIR + path.sep + 'ipfs';

        try {
            await fs.unlinkSync(path.resolve(IPFSDIR, 'api'));
        } catch (e) {
            console.log(`no api file found in ${IPFSDIR}, no problemo`);
        }

        try {
            await fs.unlinkSync(path.resolve(IPFSDIR, 'repo.lock'));
        } catch (e) {
            console.log(`no repo.log file found in ${IPFSDIR}, no problemo`);
        }

        this.ipfsFactory = IPFSFactory.create({
            type: 'js'
        });
        this.ipfsFactory.spawn = promisify(this.ipfsFactory.spawn);
        const config = stdConfig;
        if (!configuration.runAsMaster) {
            bootStrapForNodes.forEach(c => config.Bootstrap.push(c));
        }
    
        if (configuration.ipfsAllowCircuitRelay){
            config.relay.enabled = true;
            config.relay.hop.enabled = true;
        }

        const ipfsDeamon = await this.ipfsFactory.spawn({
            disposable: false,
            repoPath: SHARUDIR + path.sep + 'ipfs',
            defaultAddrs: false,  // runAsMaster ? true : false,
            init: false,
            start: false,
            config
        });


        ipfsDeamon.init = promisify(ipfsDeamon.init);
        ipfsDeamon.start = promisify(ipfsDeamon.start);

        if (!ipfsDeamon.initialized) {
            await ipfsDeamon.init();
        }

        const ipfsApi = await ipfsDeamon.start();
        ipfsd = ipfsDeamon;
        console.log("API " + ipfsApi.apiHost + ":" + ipfsApi.apiPort);
        console.log("Gateway: " + ipfsApi.gatewayHost + ":" + ipfsApi.gatewayPort);
        assert.ok(ipfsApi.apiHost, "no apihost set");
        assert.ok(ipfsApi.apiPort, "no apiport set")
        assert.ok(ipfsApi.gatewayHost, "no gatewayhost set");
        assert.ok(ipfsApi.gatewayPort, "no gatewayport set");

        return ipfsApi;
    } catch (error) {
        console.log('error');
        console.log(error);
    }
}

export async function stop() {
    ipfsd.stop = promisify(ipfsd.stop);
    await ipfsd.stop();
}