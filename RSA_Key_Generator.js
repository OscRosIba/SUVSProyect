//-----MODULOS-----

//Modulo de lectura y escritura de fucheros
const fs = require('fs');
//Modulo criptografico de Node.js
const crypto = require('crypto');

//-----CODIGO-----

//Generacion de las claves RSA de 1024 bits y con formato pem
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 1024,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
});

//Las claves se guardan en los ficheros
fs.writeFileSync('Autoridad\\private_key.pem', privateKey);
fs.writeFileSync('Autoridad\\public_key.pem', publicKey);
fs.writeFileSync('Usuario\\public_key.pem', publicKey);
fs.writeFileSync('Partido\\public_key.pem', publicKey);