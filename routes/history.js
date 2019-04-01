const express = require('express');
const router = express.Router();
const MongoClient = require('mongodb').MongoClient;
const palette = require('google-palette');

function createPredefinedChart(chart, messages) {
    let predefinedChart = {
        id: chart.id,
        config: {
            type: chart.type,
            data: {
                labels: [],
                datasets: []
            },
            options: chart.options
        }
    };

    messages.forEach((message) => {
        // console.log(JSON.stringify(message));
        for (const field of chart.fieldsOfData) {
            if (message.hasOwnProperty(field)) {
                let index = predefinedChart.config.data.datasets.findIndex(dataset => dataset.label === message.deviceId);
                const dateTimeInMs = new Date(message.date).setMilliseconds(0);
                let indexOfLabel = predefinedChart.config.data.labels.findIndex(label => label.getTime() === dateTimeInMs);
                
                if (indexOfLabel === -1) {
                    indexOfLabel += predefinedChart.config.data.labels.push(new Date(dateTimeInMs));
                }

                if (index === -1) {
                    index += predefinedChart.config.data.datasets.push({
                        label: message.deviceId,
                        data: new Array(predefinedChart.config.data.labels.length - 1).fill(NaN)
                    });
                }

                const colors = palette('mpn65', index + 1);
                predefinedChart.config.data.datasets.forEach((dataset, i) => {
                    const alreadyHasValue = dataset.data[indexOfLabel] && !isNaN(dataset.data[indexOfLabel].y);
                    const existingValue = alreadyHasValue ? dataset.data[indexOfLabel].y : NaN;
                    dataset.borderColor = `#${colors[i]}`;
                    dataset.data[indexOfLabel] = {
                        t: new Date(dateTimeInMs),
                        y: i === index ? message[field] : existingValue
                    };
                });

                break;
            }
        }
    });

    return predefinedChart;
}

router.get('/', (req, res) => {
    if (req.query.fromDate || req.query.toDate) {
        const config = req.app.get('config');
        const databaseURL = `mongodb://${config.mongo.host}:${config.mongo.port}`;

        MongoClient.connect(databaseURL, { useNewUrlParser: true })
            .then(client => {
                const db = client.db(config.mongo.database);
                const collection = db.collection(config.mongo.collection);

                const charts = req.app.get('charts');

                const query = {
                    "message.date": {
                        ...(isNaN(Date.parse(req.query.fromDate)) ? {} : { $gte: new Date(req.query.fromDate) }),
                        ...(isNaN(Date.parse(req.query.toDate)) ? {} : { $lte: new Date(req.query.toDate) })
                    }
                };

                const fields = {
                    _id: false,
                    "message.date": true,
                    "message.deviceId": true,
                    ...Object.assign({}, ...charts.map(chart => chart.fieldsOfData)
                        .flat().map(field => ({ [`message.${field}`]: true })))
                };
                console.log(JSON.stringify(query));
                // console.log(JSON.stringify(fields));

                collection.find(query, { projection: fields }).toArray()
                    .then((docs) => docs.map((doc) => doc.message))
                    .then((messages) => {
                        let predefinedCharts = charts.map((chart) => createPredefinedChart(chart, messages))
                            .filter((chart) => chart.config.data.labels && chart.config.data.labels.length);

                        res.status(200).render('history', {
                            predefinedCharts: predefinedCharts,
                            fromDate: req.query.fromDate,
                            toDate: req.query.toDate
                        });
                    })
                    .catch(error => {
                        console.error(error);
                        res.status(500).end();
                    });
            })
            .catch(error => {
                console.error(error);
                res.status(500).end();
            });
    } else {
        res.status(200).render('history', {
            predefinedCharts: [],
            fromDate: undefined,
            toDate: undefined
        });
    }
});

module.exports = router;