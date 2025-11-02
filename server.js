require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/planes', (req, res) => {
    res.json([
        {
            id: 1,
            nombre: "Básico",
            precio: 9.99,
            slots: 10,
            ram: 2048,
            almacenamiento: 10240
        },
        {
            id: 2,
            nombre: "Avanzado", 
            precio: 19.99,
            slots: 25,
            ram: 4096,
            almacenamiento: 20480
        },
        {
            id: 3,
            nombre: "Profesional",
            precio: 39.99,
            slots: 50,
            ram: 8192,
            almacenamiento: 40960
        }
    ]);
});

app.listen(PORT, () => {
    console.log(`🚀 CelerHost running on port ${PORT}`);
});