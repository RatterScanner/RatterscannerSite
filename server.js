const express = require("express");
const https = require("node:https");
const multer = require("multer");
const FormData = require('form-data');
var svgCaptcha = require('svg-captcha');
const fs = require('fs');

const upload = multer();
const app = express();
const loadingGifs = [];

app.use(express.static("images"));
app.set("view engine", "ejs");

function readKeyFile() {
    const file = 'key.txt';
    const contents = fs.readFileSync(file, 'utf-8');
    return contents;
  }

app.get("/", (req, res) => {
    res.render("index");
})

app.get("/favicon.ico", (req, res) => {
    res.download(favicon)
})

app.get("/report", (req, res) => {
    let appID = req.query.appID
    if (appID == undefined){
        res.status(404).render("404")
        return
    }

    let url = "https://api.ratterscanner.com/status/" + appID;

    function getData(url, callback) {
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

    getData(url, (jsonData) => {
        if (!jsonData) {
            res.status(500).render("error");
            return;
        }

        let completed = false;
        if (jsonData.state == "completed"){
            completed = true;
        }
        res.render("report", {completed: completed, gifName: "fadingWord.gif", appID: appID, jsonReport: jsonData});
    });
})

app.post("/upload", (req, res) => {
  const upload = multer({ storage: multer.memoryStorage() }); // Store the file in memory
  const uploadMiddleware = upload.single("jarFile");


  uploadMiddleware(req, res, (err) => {
    if (err) {
      return res.status(500).send({ message: "Error uploading file" });
    }

    const fileBuffer = req.file.buffer;
    const fileSize = req.file.size;
    const key = readKeyFile();

    if (key == null || key == ""){
        console.log("ERROR key not read")
        return res.status(500).send({ message: "Error key is null" });
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
        "api_key": key,
      }, formData.getHeaders())
    };
    let ID;

    const req2 = https.request(options, (res2) => {
      res2.on("data", (chunk) => { 
        console.log(`Received chunk: ${chunk}`);
        const jsonData = JSON.parse(chunk); // parse the response
        const ID = jsonData.id;
        res.status(200).send({ message: "Jar file uploaded successfully ID is:", appID: ID });
      });
      res2.on("end", () => {
        console.log("Upload complete");
      });
    });

    formData.pipe(req2);
  });
});

app.listen(3000);