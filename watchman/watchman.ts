import * as os from "os"

/*
This is the rate limiting code:
the format of ipList is as follows:
ips[<IP Address>] = <ipList> {
        requests: <number of requests in the last min> integer,
        filesUploaded: <number of file uploaded in the last min> integer,
        lastScore: <the last score this ip was given (0 if never given one)> integer
        banned: <true of false> bool (Bans are also stored within a file)
        lastUpdated: <unix timestamp of when this info was updated last> Date
      };

The code returns a score out of 100, a score of 100 means the request should be dropped
A score of -1 means the code broke, although it should never return that (it throws an error instead)
A score of -2 means the user has been banned. The function getBanTime(IP address) can be used to see if the ban is perm or only temp
A score of -3 means the user has uploaded too many files and should be told as such
*/

const cpus = os.cpus();
let ips: any = {}; // Format is <ipAddress> = ipList

class ipList {
  private ipAddr: string;
  private requests: number[]; // array to store request timestamps
  private filesUploaded: number[]; // array to store file upload timestamps
  private lastScore: number;
  private banned: boolean;
  private banTimeout: any; // It will either be a Date(), 0 or -2 for perm ban
  private idleTime: number;
  private requestsDropped: number[];

  constructor(ipAddrPeram: string, lastScorePeram: number) {
    this.ipAddr = ipAddrPeram;
    this.requests = [];
    this.filesUploaded = [];
    this.lastScore = lastScorePeram;
    this.banned = false;
    this.banTimeout = 0;
    this.idleTime = (Date.now() / 1000) + 900; // 15 mins in the future  
    this.requestsDropped = [];
    // Not sure if creating a new interval for each object is the best way of doing this, will change if needed
    setInterval(() => { // Clears the expired file uploads,requests and requests dropped every min
      const now = Date.now() / 1000;
      this.requests = this.requests.filter(timestamp => now - timestamp < 60); // keep only last minute's requests and file uploads
      this.filesUploaded = this.filesUploaded.filter(timestamp => now - timestamp < 60);
      this.requestsDropped = this.requestsDropped.filter(timestamp => now - timestamp < 60) // Clears the data that is over 1 min old
    }, 60 * 1000); // 1 minute
  }

  public getIP() {
    this.idleTime = (Date.now() / 1000) + 900;
    return this.ipAddr;
  }

  public getRequestCount() {
    this.idleTime = (Date.now() / 1000) + 900;
    return this.requests.length;
  }

  public addRequest() {
    this.idleTime = (Date.now() / 1000) + 900;
    this.requests.push(Date.now() / 1000); // add current timestamp to requests array
  }

  public getFileUploadCount() {
    this.idleTime = (Date.now() / 1000) + 900;
    return this.filesUploaded.length;
  }

  public addFileUpload() {
    this.idleTime = (Date.now() / 1000) + 900;
    this.filesUploaded.push(Date.now() / 1000); // add current timestamp to filesUploaded array
  }

  public getLastScore() {
    this.idleTime = (Date.now() / 1000) + 900;
    return this.lastScore;
  }

  public setLastScore(score: number) {
    this.idleTime = (Date.now() / 1000) + 900;
    this.lastScore = score;
  }

  public isBanned() {
    this.idleTime = (Date.now() / 1000) + 900;
    return this.banned;
  }

  public ban(timeout: any) { // -2 for perm ban or a Date object with the expiry time
    this.idleTime = (Date.now() / 1000) + 900;
    this.banTimeout = timeout;
    this.banned = true;
  }

  public getBanTimeout() {
    this.idleTime = (Date.now() / 1000) + 900;
    return this.banTimeout;
  }

  public addDroppedRequest() {
    this.idleTime = (Date.now() / 1000) + 900;
    this.requestsDropped.push(Date.now() / 1000);   
  }

  public getDroppedRequestCount() {
    this.idleTime = (Date.now() / 1000) + 900;
    return this.requestsDropped.length;
  }

  public getIdleTime() {
    return this.idleTime;
  }
}

export class limiting{
  private async getRecourceUseage() {
    let recource = { cpu: 0, ram: 0 };
    
    // ----- CPU average -----
    const startIdle: number[] = [];
    const startTick: number[] = [];
  
    let cpus = os.cpus();
    cpus.forEach((cpu) => {
      startIdle.push(cpu.times.idle);
      startTick.push(Object.values(cpu.times).reduce((acc, value) => acc + value, 0));
    });
  
    await new Promise((resolve) => setTimeout(resolve, 100));
  
    const endIdle: number[] = [];
    const endTick: number[] = [];
  
    cpus = os.cpus();
    cpus.forEach((cpu) => {
      endIdle.push(cpu.times.idle);
      endTick.push(Object.values(cpu.times).reduce((acc, value) => acc + value, 0));
    });
  
    let totalIdle = 0;
    let totalTick = 0;
  
    for (let i = 0; i < endIdle.length; i++) {
      totalIdle += endIdle[i] - startIdle[i];
      totalTick += endTick[i] - startTick[i];
    }
  
    const cpuUsage = 100 - (totalIdle / totalTick) * 100;
    recource.cpu = cpuUsage;
  
    // ----- RAM useage -----
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const ramUsage = (usedMem / totalMem) * 100;
    recource.ram = ramUsage;
    return recource;
  }

  public async checkRequest(ipAddress: string) {
    let client;
    let score: number = 20; // Score is out of 100. A score of 100 means the request should be dropped

    if (ips[ipAddress] == undefined) {
      client = new ipList(ipAddress, 0);
      ips[ipAddress] = client;           
    } else {
      client = ips[ipAddress];
      if (client.isBanned() == true) {
        return -2;
      } else if (client.getLastScore() >= 100) {
        score += 5;
      }
    }     
    if (client.getFileUploadCount() >= 10) { // Rate limit the user if they keep sending files after they have been told to slow down
      score += 100
    } else if (client.getFileUploadCount() >= 5) { // No more than 5 files per min
      return -3;
    } else if (client.getFileUploadCount() >= 4) {
      score += 50;
    } else if (client.getFileUploadCount() >= 2) {
      score += 20;
    }

    if (client.getRequestCount >= 100) {
      score += 100;          
    } else if (client.getRequestCount() >= 80) {
      score += 60;
    } else if (client.getRequestCount() >= 50) {
      score += 30
    } else if (client.getRequestCount() >= 20) {
      score += 10
    }

    const recource = await this.getRecourceUseage();
    if (recource.cpu >= 80) {
      score += 30
    } else if (recource.cpu >= 50) {
      score += 20
    } else if (recource.cpu >= 20) {
      score += 10;
    }
  
    if (recource.ram >= 90) {
      score += 40
    } else if (recource.ram >= 60) {
      score += 20
    } else if (recource.ram >= 40) {
      score += 10
    }

    client.setLastScore(score);
    return score;
  }

  public dropRequest(ipAddress: string) {
    let client = ips[ipAddress];
    if (client == undefined) {
      return;
    }
    client.addDroppedRequest();
  }

  public addRequest(ipAddress: string) {
    let client = ips[ipAddress];
    if (client == undefined) {
      return;
    }
    client.addRequest();
  }

  public addFileUpload(ipAddress: string) {
    let client = ips[ipAddress];
    if (client == undefined) {
      return;
    }
    client.addFileUpload();
  }

    private banIP(IPAddr: string, reason: string) { // Not implemented yet

    };
}

// Goes through every object and clears them if they have been idle for more than 15 mins
setInterval(() => {
  for (const ip in ips) {
   const ipObject = ips[ip];
   if (Date.now() / 1000 >= ipObject.getIdleTime()) {
    delete ips[ip]; // The ip has not been accessed for over 15 mins, its likley not needed so delete it
   }
  }
}, 15 * 60 * 1000); // 15 mins
