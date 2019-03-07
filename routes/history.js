const express = require('express');
const router = express.Router();
const MongoClient = require('mongodb').MongoClient;

router.get('/', (req, res) => {
    if (req.query.fromDate || req.query.toDate) {
        MongoClient.connect(databaseURL, { useNewUrlParser: true })
            .then(client => {
                const db = client.db(config.mongo.database);
                const collection = db.collection(config.mongo.collection);

                const query = {
                    date: {
                        ...(req.query.fromDate ? { $gte: req.query.fromDate } : {}),
                        ...(req.query.toDate ? { $lte: req.query.toDate } : {})
                    }
                };

                collection.find(query, { topic: false }).toArray()
                    .then((messages) => res.status(200).render('history', messages))
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
        res.status(200).render('history');
    }
});

module.exports = router;