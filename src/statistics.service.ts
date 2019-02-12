import { Contract } from "ethers";
import * as https from 'https';
import * as express from 'express';
import * as cors from 'cors';
import * as fs from 'fs';

export class StatisticsService {

    userCount: number;
    userCountLastFetch: Date;
    shareCount: number;
    shareCountLastFetch: Date;
    CACHE_INVALID = 1000 * 60; // one minute

    constructor(private sharesContractInstance: Contract, private singleFilesContractInstance: Contract) {
        console.log("starting statistic-service")
        this.updateUserCount();
        this.updateShareCount();

        const restServer = express();
        var httpServerOptions = {
            key: fs.readFileSync("/etc/letsencrypt/live/sharu.moep.net/privkey.pem"),
            cert: fs.readFileSync("/etc/letsencrypt/live/sharu.moep.net/fullchain.pem"),
        }
        var corsOptions = {
            origin: '*',
            optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
        }
        restServer.use(cors(corsOptions));
        const restPort = 8082;


        restServer.get('/userCount', (req, res) => res.status(200).send("" + this.getUserCount()));
        restServer.get('/shareCount', (req, res) => res.status(200).send("" + this.getShareCount()));
        restServer.listen(restPort - 1);
        https.createServer(httpServerOptions, restServer).listen(restPort);

    };

    async updateUserCount() {
        const now = new Date();
        if (this.userCountLastFetch === undefined || ((this.userCountLastFetch.getTime() + this.CACHE_INVALID) < now.getTime())) {
            this.userCountLastFetch = now;
            this.userCount = (await this.singleFilesContractInstance.getUserCount()).toNumber();
        }
    }
    async updateShareCount() {
        const now = new Date();
        if (this.shareCountLastFetch === undefined || ((this.shareCountLastFetch.getTime() + this.CACHE_INVALID) < now.getTime())) {
            this.shareCountLastFetch = now;
            this.shareCount = (await this.sharesContractInstance.getShareCount()).toNumber();
        }
    }
    getUserCount(): number {
        this.updateUserCount();
        return this.userCount;
    }
    getShareCount(): number {
        this.updateShareCount();
        return this.shareCount;
    }
}