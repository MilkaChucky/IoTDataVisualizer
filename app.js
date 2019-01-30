const fs = require('fs');
const express = require('express');
const app = express();
const httpServer = require('http').Server(app);
const io = require('socket.io')(httpServer);
const mqtt = require('mqtt');
const router = express.Router();
const config = JSON.parse(fs.readFileSync('config.json'));

let charts = [];
config.charts.forEach((chart, i) => {
   charts.push({
       id: i,
       fieldsOfData: chart.fieldsOfData,
       type: chart.chartOptions.type,
       maxNumberOfPoints: chart.chartOptions.maxNumberOfPoints,
       options: { ...config.globalChartOptions, ...chart.chartOptions.options },
       devices: {}
   }); 
});

let mqttClient = mqtt.connect([{
    host: process.env.MQTT_BROKER_URL || 'localhost',
    port: process.env.MQTT_BROKER_PORT || 1883
}]);

mqttClient.on('connect', (connack) => {
    //console.log(charts);
    config.mqttTopics.forEach((topic) => {
        //console.log(topic);
        mqttClient.subscribe(topic, (err, granted) => {            
            if (err) console.error(err);
        });
    });
});

mqttClient.on('message', (topic, message) => {
    let json = JSON.parse(message.toString());
    //console.log(json);
    charts.forEach((chart) => {
        for (const field of chart.fieldsOfData) {
            if (json[field]) {
                chart.devices[json.deviceId] = [json[field]];
                io.emit('data', {
                    id: chart.id,
                    date: json.date,
                    devices: chart.devices
                });
                break;
            }
        };
    });
});

app.set('view engine', 'ejs')

/*
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', 1);
app.use(session({
    secret: "#Kd8saodJLKSm492382kKSmx&@E^21KDltsdx#$$231Aa",
    resave: true,
    saveUninitialized: true,
    cookie: { 
        secure: false, 
        maxAge: 3000000 
    }
}));
*/

app.use(express.static('public'));

router.get('/', (req, res) => res.render('index'));

app.get('/scripts/chart.js', (req, res) => res.sendFile(`${__dirname}/node_modules/chart.js/dist/Chart.bundle.min.js`));
app.get('/chartoptions/:id', (req, res) => {
    let id = parseInt(req.params.id);
    let chart = charts.find((c) => c.id === id);
    res.json({
        type: chart.type,
        maxNumberOfPoints: chart.maxNumberOfPoints,
        options: chart.options
    });
});
app.use('/', router);
// app.use((req, res) => {
//     res.redirect('/');
// });

let port = process.env.IOT_VIS_PORT || 3000;
httpServer.listen(port, () => {

    console.log(`IoTDataVisualizer is running on port ${port}!`);
});

process.on('SIGUSR1', () => process.exit());
process.on('SIGUSR2', () => process.exit());
process.on('SIGINT', () => process.exit());
process.on('exit', () => mqttClient.end());