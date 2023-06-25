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

//Leer las clave publica para el cifrado de la mascara
const publicKey = fs.readFileSync('public_key.pem', 'utf8');

//Extraemos el modulo y los exponentes para su uso en la enmascaración
const pkey = crypto.createPublicKey(publicKey);
const pkeyjwk = pkey.export({format: 'jwk'})

//Modulo: Conversión de base64 a hexadecimal y posteriormente a decimal(bigint)
var n = Buffer.from(pkeyjwk['n'], 'base64');
n = n.toString('hex');
n = bigInt(n, 16)

console.log("-MODULO: " + n.toString())

//Exponente publico: Conversión de base64 a hexadecimal y posteriormente a decimal(bigint)
var e = Buffer.from(pkeyjwk['e'], 'base64');
e = e.toString('hex');
e = bigInt(e, 16)

console.log("-EXPONENTE PUBLICO: " + e.toString())

//Generamos una mascara invertible (entero aleatorio invertible modulo n)
var mask = bigInt.randBetween("1", n)
//Condicion de invertibilidad mcd(mascar,modulo) = 1
while(bigInt.gcd(mask, n) != 1){
    mask = bigInt.randBetween("1", n)
}

console.log("-MASCARA: " + mask.toString())

//-----IPs DE CONEXION-----

//Ip de la autoridad
var listIP = []

//-----VARIABLES GLOBALES-----

//Diccionario de claves con los puntos
var P = {}
//Voto del usuario
var voto = parseInt(Buffer.from(process.argv[2], 'base64').toString('hex'), 16)
//Id del votante
var id = process.argv[3].toString()
//Coeficientes
var coef = []

console.log("-IDENTIFICACION: " + id)

console.log("-VOTO: " + process.argv[2].toString())

console.log("-VOTO COMO ENTERO: " + voto.toString())

//-----DEFINICION DE FUNCIONES-----

//Generacion de la función polinomica
//De momento funcion para 4 partidos
function poly(x){
    result = 0
    for(i = 0; i < listIP.length - 1; i++){
        result += coef[i]*Math.pow(x,i+1)
    }
    result += voto
    return result
}

//Funcion para enviar los puntos a los partidos 
function enviarPuntos(shash, bs){
    //Enviar los puntos a los diferentes partidos mediante 4 conexiones
    var i = 0
    for (IP in listIP){
        //Cordenada x del punto
        cordx = Object.keys(P)[i]
        //Cordenada y del punto
        cordy = P[cordx]
        //Conectando al partido i
        console.log("-CONECTADO AL PARTIDO " + listIP[IP])
        //Formato del mensaje a enviar
        msg = cordx + ";" + cordy + ";" + shash + ";" + bs
        //Conexion con el partido y para enviarle el mensaje
        conectWithPartie(msg, listIP[IP])
        i++
    }
}

//Funcion para conectarse al partido y enviar los datos correspondientes
function conectWithPartie(msg, IP){

    //Conexion cliente con el partido 
    const partido = net.createConnection({ host: IP, port: 2000 }, () => {
        //Enviar mensaje con su respectivo formato punto;hash del voto;firma
        partido.write(msg)
    });

    //Datos recibidos del partido
    partido.on('data', (data) => {
        //Recepcion de confirmacion de envio del punto
        console.log("-" + data.toString().toUpperCase())
        partido.end()
    });
  
    //Fin de la conexion con el partido
    partido.on('close', () => {
        console.log('-FIN DE CONEXION CON EL PARTIDO')
    });
}

//-----CODIGO-----

//Guardar las IP de los partidos
fs.readFile('../Volumenes/IpContainer.txt', 'utf8', (err, data) => {
    if (err) throw err
  
    //Separar por lineas
    listIP = data.split('\n')
    listIP.pop()

    //Test para ver las IP
    console.log("-LISTA DE IP: " + listIP)
});

setTimeout(() => {

    //Generacion de coeficientes
    for(i = 0; i < listIP.length - 1; i++){
        coef.push(bigInt.randBetween(0, 10000))
    }
    console.log("-COEFICIENTES GENERADOS: " + coef)

    //Generacion de un punto por partido y almacenamiento en el diccionario P
    for(IP in listIP){
        if(IP != ""){
            var alea = bigInt.randBetween(0, 10000)
            P[alea.toString()] = poly(alea)
        }
    }

    //Muestra por consola (Uso para test)
    console.log("-PUNTOS: " + JSON.stringify(P))

    //Generamos el hash mediante el algoritmo sha256 y lo guardamos en hexadecimal
    const shash = crypto.createHash('sha256').update(JSON.stringify(P)).digest('hex');

    //Muestra por consola (Uso para test)
    console.log("-HASH DEL VOTO EN HEXADECIMAL: " + shash)

    //Construimos el voto y le aplicamos la mascara encriptada mediante la clave publica de la firma
    const b = bigInt(shash, 16).multiply(mask.modPow(e,n)).mod(n).toString(16)

    //Muestra por consola (Uso para test)
    console.log("-VOTO ENMASCARADO EN HEXADECIMAL: " + b)

    //Contacta con la autoridad para que se firme el hash
    const autenticarUsuario = net.createConnection({ host: process.env.IP_AUTORIDAD, port: 2000 }, () => {
        console.log("-CONECTADO A LA AUTORIDAD")

        //Enviar el hash enmascarado (Posteriormente añadir el identificador)
        autenticarUsuario.write(id + ";" + b)
    });

    //Datos recibidos de la institución de autoridad
    autenticarUsuario.on('data', (data) => {
        if(data.toString() !== "Error"){
            console.log("-VOTO FIRMADO CON MASCARA: " + data.toString())

            //Recibimos el voto firmado y le eliminamos la mascara
            bs = bigInt(data.toString(),16).multiply(mask.modInv(n)).mod(n).toString(16)

            //Muestra por consola (Uso para test)
            console.log("-VOTO FIRMADO SIN MASCARA: " + bs)
            autenticarUsuario.end()
        }else
        {
            bs = data.toString()
            console.log("-FIRMA: Error")
            autenticarUsuario.end()
        }
    });

    //Fin de la conexion con la entidad
    autenticarUsuario.on('close', () => {
        console.log("-FIN DE CONEXION CON LA AUTORIDAD")
        //Llamada a la funcion que se encarga de enviar los puntos a los partidos
        //Se llama al cerrar la conexion con la entidad para asegurar que los datos ya se pueden enviar
        enviarPuntos(shash,bs)
    });
}, 2500);
