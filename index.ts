import express, { Express } from "express";
import { randomBytes } from "node:crypto";
import { createHash, createHmac } from "node:crypto";
import { createChallenge } from "altcha-lib";
import https from "node:https";
import axios from "axios";
import multer from "multer";
import FormData from "form-data";
import fs from "fs";
import { constrainedMemory } from "node:process";

try {
  globalThis.crypto = require("node:crypto").webcrypto; // This is needed for older versions of nodeJS that do not have a global declaration of crypto
} catch {

}

interface Config {
  apiKey: string;
  fileSizeLimit: number;
  altchaKey: string;
  captchaKey: string;
  siteKey: string;
  port: number;
}

let config: Config | undefined;

try {
  const data = fs.readFileSync("config.json", "utf8");
  config = JSON.parse(data);
} catch (error) {
  console.error("Error reading config file:", error);
  throw new Error("Program Terminated");
}

if (!config) {
  console.error("Config is null and the program cannot continue");
  throw new Error("Program Terminated");
}

const key = config.apiKey;

if (!key || key === "" || key === "<apikeyGoHere>") {
  console.error("Key is null because of this the program cannot continue");
  throw new Error("Program Terminated");
}

const fileSizeLimit = config.fileSizeLimit; // The maximum file size an uploaded file can have (In MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: fileSizeLimit * 1024 * 1024,
  },
});

const logger = (req : any, res : any, next : any) => {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
 // console.log(`[${new Date().toISOString()}] -- ${ip} --  ${req.method} ${req.url}`);
  next();
};

const app: any = express();
const hmacKey = randomBytes(16).toString("hex");
let captchaList : any = {};
const maxCaptcha = 2;
let captchaIndex = 0; // keep track of the current index in the circular queue

app.use(express.static("images"));
app.use(express.static("styles"));
app.use(express.static("scripts"));
app.set('view engine', "ejs");
app.use(express.json());
app.use(logger);
// --------------------------------------------------
// Put all functions here

const validateCaptcha = async (req: any) => {
  const humanKey = req.body["g-recaptcha-response"];

  try {
    const response = await fetch(`https://challenges.cloudflare.com/turnstile/v0/siteverify`, {
      method: 'post',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8'
      },
      body: `secret=${config.captchaKey}&response=${humanKey}`
    });

    const json = await response.json();
    const isHuman = json.success;

    return isHuman;
  } catch (err: any) {
    console.error(`Error in Siteverify API: ${err.message}`);
    return false;
  }
};

// --------------------------------------------------
// Routes only beyond this point

app.get("/", (req: any, res: any) => {
  res.render("index", {fileLimit: fileSizeLimit, siteKey: config.siteKey});
})

app.get("/favicon.ico", (req: any, res: any) => {
	res.download("https://ratterscanner.com/favicon.ico")
})

app.get("/report", (req: any, res: any) => {
    let appID = req.query.appID;
    let downloadCount = req.query.downloads; // Taking downloads in the url is a bad idea because someone can easily manipulate it
    if (appID == "undefined"){
        res.status(404).render("404");
        return;
    }

    let url = "https://api.ratterscanner.com/status/" + appID;

    function getData(url: any, callback: any) {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
              try {
                let jsonData = JSON.parse(data);
                callback(jsonData);
              } catch (err){
                console.log(err)
                callback(null)
              }
            });
        }).on('error', (err) => {
            console.error(err);
            callback(null);
        }); 
    }

    getData(url, (jsonData: any) => {
        if (!jsonData) {
            res.status(500).render("error");
            return;
        }

        let completed = jsonData.state;
        let percentComplete;
        
        try {
          percentComplete = jsonData.progress.regex.percentageCompleted;
          if (!(percentComplete > 0)) {
            percentComplete = 1
          }

        } catch {
          percentComplete = 1;
        }

        let status;
        let position;
        try {
          if (completed == "active") {
            status = jsonData.progress.networkAnalysis.status;
          } else if (completed == "waiting") {
            status = "Waiting for analysis";
            position = jsonData.position;
          }
        } catch {
          console.error("Failed to get analysis status")
          res.status(500).send("Internal server error")
          return;
        }        
        res.render("report", {completed: completed, percentage: percentComplete, status: status, quePosition: position, downloads: downloadCount, gifName: "fadingWord.gif", appID: appID, jsonReport: jsonData});
    });
})

app.post("/upload", upload.single("jarFile"), async (req: any, res: any) => { // TODO: debloat this class
  // ---------------------------- POW rate limiting
  const authorization = req.get("Authorization");
  if (authorization == undefined) {
    let expiration = new Date(Date.now() + 2 * 60 * 1000); // 2 mins from now
    let captchaID = Math.random().toString(36).substring(2, 9);
    try {
      console.log("Generating POW verification")
      const challenge = await createChallenge({ // Generate a new random challenge with a specified complexity
        hmacKey: hmacKey,
        maxNumber: 250000
      }); // TODO: Increace the challenge complexity based on factors like load, number of requests etc

      if (Object.keys(captchaList).length >= maxCaptcha) { // Removes the oldest captcha if the que reaches the limit
        delete captchaList[Object.keys(captchaList)[captchaIndex % maxCaptcha]];
      }

      captchaList[captchaID] = {
        challenge: challenge,
        hmacKey: hmacKey,
        expires: expiration
      };

      captchaIndex++;

      res.status(401).send({WWW_Authenticate: {challenge}, ID: captchaID})
      return;
    } catch (error: any) {
      res.status(500).send({error: "Failed to create challenge"})
      console.error("Failed to create challenge: " + error.message)
      return;
    }
  }

  try {
    const authorization = req.get("Authorization");
    const payload = Buffer.from(authorization.split(' ')[1], "base64").toString("utf8");
    const data = JSON.parse(payload);
    const currentTime = new Date();
  
    const captchaID = data.id;
    const solution = data.solution;
    const salt = data.salt;
    const challenge = data.challenge;

    let captcha = captchaList[captchaID];

    if (!(captcha)) {
      console.log("FILE REJECTED: POW captcha invalid")
      res.status(401).send({ message: "Invalid POW captcha. IF this issue persists please report it to a developer" });
      return;
    }
  
    // Challenge validation
    const recomputedChallenge = createHash("sha256");
    recomputedChallenge.update(`${salt}${solution}`);
    const recomputedChallengeHex = recomputedChallenge.digest("hex");
  
    if (recomputedChallengeHex !== challenge) {
      console.log("FILE REJECTED: Invalid POW solution")
      res.status(401).send({ message: "Invalid POW challenge solution. If this issue persists please report it to a developer" });
      return;
    }
  
    // Signature validation
    const signature = createHmac("sha256", hmacKey);
    signature.update(challenge);
    const expectedSignatureHex = signature.digest("hex");
    if (captcha.challenge.signature !== expectedSignatureHex) {
      console.log("FILE REJECTED: Invalid POW signature")
      res.status(401).send({ message: "Invalid signature" });
      return;
    }
  
    if (!(captcha.expires > currentTime)) {
      console.log("FILE REJECTED: Expired POW challenge")
      res.status(401).send({ message: "Expired challenge. Please refresh the page and try again" });
    }

   delete captchaList[captchaID];
  } catch (error: any) {
    console.error(error)
    res.status(500).send("Internal server error")
    return;
  }
  // ---------------------------

  console.log("Validating captcha")

  // Validate captcha
  const captchaValid = await validateCaptcha(req);
  if (!captchaValid) {
    console.log("FILE REJECTED: Invalid captcha")
    return res.status(400).send({ message: "Invalid captcha" });
  }
  console.log("Validating file")
  if (!req.file) {
    console.log("FILE REJECTED: Did not upload file")
    return res.status(400).send({ message: "No file uploaded" });
  }
  console.log()

  const fileBuffer = req.file.buffer; // Moved this here to prevent crashes if someone bypasses client side file checks - Sylus
  console.log("Recieved file")

  if (fileBuffer == undefined) {
    console.error("File upload failed, fileBuffer is undefined")
    return res.status(500).send({ message: "File upload failed, fileBuffer is null. If this error persists please report it to a developer" });
  }

  const magicNumber = fileBuffer.toString('hex', 0, 4);


  if (magicNumber !== '504b0304') { // Check if a file is actually a jar file with magic bytes
    console.log("FILE REJECTED: Invalid JAR file")
    return res.status(400).send({ message: "Invalid JAR file" });
  }

  const formData = new FormData();
  formData.append("file", fileBuffer, {
    filename: req.file.originalname
  });

  console.log("Sending to ratterscanner");

  const options = {
    method: "POST",
    url: "https://api.ratterscanner.com/jar_scanner",
    headers: {
      "api_key": key,
      ...formData.getHeaders()
    },
    data: formData
  };

  try {
    const response = await axios(options);
    const jsonData = response.data;
    let fileSource;

    if (jsonData.status == "File found in safe list, not scanning") { // The file has been manually marked as safe by a human
      try {
        if (Object.keys(jsonData.knownFileDetails.modrinthInfo).length > 0) {
          fileSource = jsonData.knownFileDetails.modrinthInfo.repoUrl;
        } else {
          fileSource = jsonData.knownFileDetails.githubInfo.repoUrl;
        }
        res.status(200).send({ message: "File is safe", fileName: jsonData.fileName, download: fileSource});
        return;
      } catch {
        fileSource = "None";
      }
    }
    let downloads = jsonData.knownFileDetails?.modrinthInfo.amountOfDownloads;
    if (downloads == undefined) { // If the file has zero downloads or does not exist on modrinth 
      downloads = -1
    }
    const ID = jsonData.id;
    res.status(200).send({ message: "Jar file uploaded successfully ID is:", appID: ID, downloads: downloads});
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
});

app.get("/safe", function (req: any, res: any) {
  const data = JSON.parse(req.query.data);  
  res.render("safe", {fileName: data.fileName, downloadLink: data.fileDownload});
});

app.use((err : any, req : any, res : any, next : any) => { // Catch Files that are too large
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(400).send({ message: "Files cannot be larger than: " + fileSizeLimit + "MB" });
    } else {
      res.status(500).send({ message: "Error uploading file" });
    }
  } else {
    next(err);
  }
});

app.use(function (req: any, res: any) {
	res.status(404).render("404")
});

app.listen(config.port);
console.log(`Listening to port ${config.port}`)
