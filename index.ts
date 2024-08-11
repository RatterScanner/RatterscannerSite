import express, { Express } from "express";
import { randomBytes } from "node:crypto";
import { createHash, createHmac } from "node:crypto";
import { createChallenge, verifySolution } from 'altcha-lib';
import https from "node:https";
import multer from "multer";
import FormData from "form-data";
import fs from "fs";

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
  const data = fs.readFileSync('config.json', 'utf8');
  config = JSON.parse(data);
} catch (error) {
  console.error('Error reading config file:', error);
  throw new Error('Program Terminated');
}

if (!config) {
  console.error('Config is null and the program cannot continue');
  throw new Error('Program Terminated');
}

const key = config.apiKey;

if (!key || key === '' || key === '<apikeyGoHere>') {
  console.error('Key is null because of this the program cannot continue');
  throw new Error('Program Terminated');
}

const upload = multer();
const app: any = express();
const fileSizeLimit = config.fileSizeLimit; // The maximum file size an uploaded file can have (In MB)
const hmacKey = randomBytes(16).toString('hex');

app.use(express.static('images'));
app.set('view engine', 'ejs');
app.use(express.json());
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
    console.error(`Error in Google Siteverify API: ${err.message}`);
    return false;
  }
};

async function hmacSha256(message: any, key: any) {
  const encoder = new TextEncoder();
  const encodedMessage = encoder.encode(message);
  const encodedKey = encoder.encode(key);

  const hmac = await crypto.subtle.importKey(
    "raw",
    encodedKey,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign("HMAC", hmac, encodedMessage);
  const signatureArray = Array.from(new Uint8Array(signatureBuffer));
  const signatureHex = signatureArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
  return signatureHex;
}

// --------------------------------------------------
// Routes only beyond this point

app.get("/", (req: any, res: any) => {
    res.render("index", {siteKey: config.siteKey, hKey: hmacKey});
})

app.get("/favicon.ico", (req: any, res: any) => {
	res.download("https://ratterscanner.com/favicon.ico")
})

app.get("/report", (req: any, res: any) => {
    let appID = req.query.appID;
    let downloadCount = req.query.downloads;
    if (appID == undefined){
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
                let jsonData = JSON.parse(data);
                callback(jsonData);
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

        let completed = false;
        if (jsonData.state == "completed"){
            completed = true;
        }
        res.render("report", {completed: completed, percentage: jsonData.progress.regex.percentageCompleted, status: jsonData.progress.networkAnalysis.status, downloads: downloadCount, gifName: "fadingWord.gif", appID: appID, jsonReport: jsonData});
    });
})

app.post("/upload", upload.single("jarFile"), async (req: any, res: any) => {
  // ---------------------------- POW rate limiting
  const authorization = req.get("Authorization");
  if (authorization == undefined) {
    try {
      // Generate a new random challenge with a specified complexity
      const challenge = await createChallenge({
        hmacKey: hmacKey,
        maxNumber: 250000
      })
  
      // Return the generated challenge as JSON
      res.status(401).send({WWW_Authenticate: {challenge}})
      return;
    } catch (error: any) {
      // Handle any errors that occur during challenge creation
      res.status(500).send({
        error: 'Failed to create challenge',
        details: error.message
      })
      console.error("Failed to create challenge: " + error.message)
      return;
    }
  }

  try {
    const authorization = req.get("Authorization");
    const payload = Buffer.from(authorization.split(' ')[1], 'base64').toString('utf8');
    const data = JSON.parse(payload);
  
    const algOk = data.algorithm === 'SHA-256';
    const hash = createHash('sha256');
    hash.update(`${data.salt}${data.number}`);
    const challengeHash = hash.digest('hex');
    const challengeOk = challengeHash === data.challenge;

    // Generate the HMAC signature using the hmacSha256 function
    const hmacSignature = await hmacSha256(`${data.salt}${data.number}`, hmacKey);
    const signatureOk = hmacSignature === data.signature;

    const verified = algOk && challengeOk && signatureOk;
  
    if (!verified) {
      res.status(400).send("Validation failed");
      return;
    }
  
  } catch (error: any) {
    console.error(error)
    res.status(500).send("Internal server error")
    return;
  }
  // ---------------------------

  const fileBuffer = req.file.buffer;
  const fileSize = req.file.size;
  
  console.log("Recieved file")

  // Validate captcha
  const captchaValid = await validateCaptcha(req);
  if (!captchaValid) {
    return res.status(400).send({ message: "Invalid captcha" });
  }

  if (!req.file) {
    return res.status(400).send({ message: "No file uploaded" });
  }
  const magicNumber = fileBuffer.toString('hex', 0, 4);

  if (magicNumber !== '504b0304') { // Check if a file is actually a jar file with magic bytes
    return res.status(400).send({ message: "Invalid JAR file" });
  }

  if (fileSize / (1024 * 1024) > fileSizeLimit) {
    return res.status(400).send({ message: "Files cannot be larger than " + fileSizeLimit + " MB" });
  }

  const formData = new FormData();
  formData.append("file", fileBuffer, {
    contentType: "application/octet-stream",
    filename: req.file.originalname
  });

  const options = {
    method: "POST",
    hostname: "api.ratterscanner.com",
    path: "/jar_scanner",
    headers: Object.assign({
      "Host": "api.ratterscanner.com",
      "api_key": key,
    }, formData.getHeaders())
  };
  let ID;

  const req2 = https.request(options, (res2) => {
    let data = "";
  
    res2.on("data", (chunk) => { 
      console.log("Recived chunk: " + chunk)
      data += chunk;
    });
  
    res2.on("end", () => {
      console.log("Upload complete");
      const jsonData = JSON.parse(data); // parse the response
      let fileSource
  
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
    });
  });

  formData.pipe(req2);
});

app.get("/safe", function (req: any, res: any) {
  const data = JSON.parse(req.query.data);
  
  res.render("safe", {fileName: data.fileName, downloadLink: data.fileDownload});
});

app.use(function (req: any, res: any) {
	res.status(404).render("404")
});

app.listen(config.port);
console.log("Listening")