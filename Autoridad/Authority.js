//-----MODULOS-----

//Modulo de conexiones
const net = require('net')
//Modulo criptografico de Node.js
const crypto = require('crypto')
//Modulo de lectura y escritura de fucheros
const fs = require('fs');
//Modulo para tratar con numeros enteros grandes
const bigInt = require('big-integer');

//-----LECTURA Y PROCESAMIENTO DE LAS CLAVES-----

//Leer la clave privada para la firma del voto
const privateKey = fs.readFileSync('private_key.pem', 'utf8');

//Extraemos el modulo y los exponentes para su uso en la enmascaración
const pkey = crypto.createPrivateKey(privateKey);
const pkeyjwk = pkey.export({format: 'jwk'})

//Modulo: Conversión de base64 a hexadecimal y posteriormente a decimal(bigint)
var n = Buffer.from(pkeyjwk['n'], 'base64');
n = n.toString('hex');
n = bigInt(n, 16)

console.log("-MODULO: " + n.toString())

//Exponente privado: Conversión de base64 a hexadecimal y posteriormente a decimal(bigint)
var d = Buffer.from(pkeyjwk['d'], 'base64');
d = d.toString('hex');
d = bigInt(d, 16)

console.log("-EXPONENTE PRIVADO: " + d.toString())

//-----VARIABLES-----

//ListaVotantes
listaVotantes = ["11111111A","22222222B","33333333C"]
//Hora de cierre de votacion
var horaFin = process.argv[2].toString()
//Minuto de cierre de votacion
var minFin = process.argv[3].toString()

console.log("-LISTA DE VOTANTES: " + listaVotantes)

//-----CODIGO-----

//Servidor de la entidad para la escucha de los usuarios
const server = net.createServer((socket) => {

    //Datos recibidos por el usuario
    socket.on('data', (data) => {
        //Convertimos el voto a cadena hexadecimal
        msg = data.toString().split(";")
        id = msg[0]
        b = msg[1]

        //Muestra por consola (Uso para test)
        console.log("-USUARIO " + id + " CONECTADO")
        console.log("-DATOS RECIBIDOS DEL USUARIO: " + b)
        if(listaVotantes.includes(id))
        {
            //Eliminar de la lista de votantes
            listavotantes = listaVotantes.splice(listaVotantes.indexOf(id),1);
            //Firma del voto usando el exponente privado de la clave
            bs = bigInt(b,16).modPow(d,n).mod(n).toString(16)

            fs.appendFileSync('../Volumenes/PBB_Autoridad.txt', "Identificación: " + id + " Certificado: " + bs +"\n")

            //Muestra por consola (Uso para test)
            console.log("-VOTO FIRMADO POR LA AUTORIDAD: " + bs)
            //Se devuelve el voto firmado
            socket.write(bs)
        }
        else
        {
            console.log("-USUARIO " + id + " NO ESTA EN LA LISTA DEL CENSO")
            socket.write("Error")
        }
    });

    //Desconexion del usuario
    socket.on('close', () => {
        console.log("-USUARIO " + id + " DESCONECTADO")
    });
});

//Escucha en el puerto PORT
server.listen(2000, () => {
    console.log("-SERVIDOR TCP INICIADO EN EL PUERTO 2000")
});

//Cierre del servidor de la entidad
const intervalId = setInterval(() => {

    //hora actual
    const now = new Date();
    const hours = now.getHours().toString()
    const minutes = now.getMinutes().toString()

    //Si la hora actual es igual a la indicada se procede al cierre
    if (hours === horaFin && minutes === minFin) {
      server.close(() => {
        clearInterval(intervalId);
        console.log("-SERVIDOR CERRADO")
      });
    }
}, 10000);//COmprobacion cada segundo 