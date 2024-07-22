const express = require("express");
const app = express();
const loadingGifs = [];
const https = require('node:https');

app.use(express.static("images"));
app.set("view engine", "ejs");

app.get("/", (req, res) => {
    res.render("index");
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

app.listen(3000);