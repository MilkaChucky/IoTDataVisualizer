const express = require('express');
const app = express();
const httpServer = require('http').Server(app);
const io = require('socket.io')(httpServer);
const mqtt = require('mqtt');

const config = require('./config');
const realtimeRouter = require('./routes/realtime');
const historyRouter = require('./routes/history');

const brokerURL = `mqtt://${config.mqtt.host}:${config.mqtt.port}`;

Object.defineProperty(Array.prototype, 'flat', {
    value: function(depth = 1) {
      return this.reduce(function (flat, toFlatten) {
        return flat.concat((Array.isArray(toFlatten) && (depth-1)) ? toFlatten.flat(depth-1) : toFlatten);
      }, []);
    }
});

let charts = [];

config.visuals.charts.forEach((chart, i) => {
    charts.push({
        id: i,
        fieldsOfData: chart.fieldsOfData,
        type: chart.chartOptions.type,
        maxNumberOfPoints: chart.chartOptions.maxNumberOfPoints,
        options: { ...config.visuals.globalChartOptions, ...chart.chartOptions.options },
        devices: {}
    });
});

let mqttClient = mqtt.connect(brokerURL, {
    clientId: config.mqtt.clientId,
    username: config.mqtt.username,
    password: config.mqtt.password
});

mqttClient.on('error', (error) => console.error(error));
mqttClient.on('close', () => console.log('Disconnecting from mqtt broker'));
mqttClient.on('reconnect', () => console.log('Reconnecting to mqtt broker'));

mqttClient.on('connect', (connack) => {
    console.log(`Connected to mqtt broker on url ${brokerURL}`);

    mqttClient.subscribe(config.mqtt.topic, (err, granted) => {
        if (err) console.error(err);
        console.log(`Subscribed to ${config.mqtt.topic}`);
    });
});

mqttClient.on('message', (topic, message) => {
    let json = JSON.parse(message.toString());

    charts.forEach((chart) => {
        for (const field of chart.fieldsOfData) {
            if (json[field]) {
                let deviceId = json.deviceId || 'Default device';
                chart.devices[deviceId] = [json[field]];
                io.emit('data', {
                    id: chart.id,
                    date: json.date || new Date(),
                    devices: chart.devices
                });
                break;
            }
        };
    });
});

app.set('view engine', 'ejs');
app.set('config', config)
app.set('charts', charts);

app.use(express.static('public'));
app.use('/', realtimeRouter);
app.use('/history', historyRouter);

app.get('/scripts/chart.js', (req, res) => res.status(200).sendFile(`${__dirname}/node_modules/chart.js/dist/Chart.bundle.min.js`));
app.get('/chartoptions/:id', (req, res) => {
    let id = parseInt(req.params.id);
    let chart = charts.find((c) => c.id === id);
    
    if (chart) {
        res.status(200).json({
            type: chart.type,
            maxNumberOfPoints: chart.maxNumberOfPoints,
            options: chart.options
        });
    } else {
        res.status(404).end();
    }
});

// app.use((req, res) => {
//     res.redirect('/');
// });

httpServer.listen(config.port, () => {
    console.log(`IoTDataVisualizer is running on port ${config.port}!`);
});

process.on('SIGUSR1', () => process.exit());
process.on('SIGUSR2', () => process.exit());
process.on('SIGINT', () => process.exit());
process.on('exit', () => {
    Promise.all([
        new Promise((resolve) => io.close(resolve)),
        new Promise((resolve) => httpServer.close(resolve)),
        new Promise((resolve) => mqttClient.end(undefined, resolve))
    ]);
});