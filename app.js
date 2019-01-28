const express = require('express');

const app = express();
const httpServer = require('http').Server(app);
const io = require('socket.io')(httpServer);
const mqtt = require('mqtt');
const router = express.Router();

let mqttClient = mqtt.connect('mqtt://localhost');
mqttClient.on('connect', (connack) => {
    mqttClient.subscribe('#', (err, granted) => {
        if (err) console.error(err);
    });
});

mqttClient.on('message', (topic, message) => {
    io.emit(topic, message);
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
app.use('/', router);
// app.use((req, res) => {
//     res.redirect('/');
// });

let port = process.env.IOT_VIS_PORT || 3000;
httpServer.listen(port, () => {

    console.log(`IoTDataVisualizer is running on port ${port}!`);
});

let shutdownListener = function() {
    mqttClient.end();
}

process.on('SIGUSR1', shutdownListener);
process.on('SIGUSR2', shutdownListener);
process.on('SIGINT', shutdownListener);
process.on('exit', shutdownListener);