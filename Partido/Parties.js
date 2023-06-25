//-----MODULOS-----

//Modulo de conexiones
const net = require('net')
//Modulo criptografico de Node.js
const crypto = require('crypto')
//Modulo de lectura y escritura de fucheros
const fs = require('fs');
//Modulo para tratar con numeros enteros grandes
const bigInt = require('big-integer');
//Modulo para obtener informacion de las ip
var os = require('os');

//-----IPs DE CONEXION-----

//IP propia
var IPpropia = os.networkInterfaces()["eth0"][0]["address"]
console.log("-IP PROPIA: " + IPpropia)
//Lista IPs
var listIP = []

//-----LECTURA Y PROCESAMIENTO DE LAS CLAVES-----

//Leer las claves
const publicKey = fs.readFileSync('public_key.pem', 'utf8');

//Modulo y exponente
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

//-----VARIABLES GLOBALES-----

//Diccionario de claves con los puntos
var puntos = {}
//Diccionario de puntos auxiliar(Se usa para guardar las recepciones de los otros partidos sin alterar el diccionario original por la asincronia)
var auxpoints = {}
//Diccionario para almacenar el conteo de votos para cada partido
var conteo = {}
//Variable para contar cuantos diccionarios se han recibido de los otros partidos
var receptions = 0
//Hora de cierre de votacion
var horaFin = process.argv[2].toString()
//Minuto de cierre de votacion
var minFin = process.argv[3].toString()
//-----DEFINICION DE FUNCIONES-----

//Envio del diccionario a los otros partidos
function partieToPartie(){
    //Enviar los puntos a los diferentes partidos
    for (var IP in listIP){
        if(listIP[IP] !== IPpropia){
            const sendpoints = net.createConnection({ host: listIP[IP], port: 3000 }, () => {
                //Enviar punto
                sendpoints.write(JSON.stringify(puntos))
            });

            //Datos recibidos de los partidos
            sendpoints.on('data', (data) => {
                //Confirmacion de recepcion
                console.log("-PUNTOS ENVIADOS CORRECTAMENTE AL PARTIDO")
                sendpoints.end()
            });
          
            //Fin de la conexion
            sendpoints.on('close', () => {
                console.log("-FIN DE CONEXION CON EL PARTIDO")
            });
        }
    }
}

//Interpolacion de lagrange para obtener el termino independiente
function interpolate(f,x)
{
    let result = 0;
    
    //Sumatorio(y*li(x))
    for (let i = 0; i < f.length; i++)
    {
        let term = f[i][1];
        //li(x) = Productorio((x-xk)/(xi-xk))
        for (let k = 0; k < f.length; k++)
        {
            if (k != i)
                term = term*(x - f[k][0]) / (f[i][0] - f[k][0])
        }
        result += term
    }
    
    return result;
}

//-----CODIGO-----

fs.appendFileSync('../Volumenes/IpContainer.txt', IPpropia + "\n")

setTimeout(() => {
    fs.readFile('../Volumenes/IpContainer.txt', 'utf8', (err, data) => {
        if (err) throw err
      
        //Separar por lineas
        listIP = data.split('\n')
        listIP.pop()
    
        //Test para ver las IP
        console.log("-LISTA DE IP: " + listIP)
    });

    //SERVIDORES
    //Servidor del partido al usuario
    const partido = net.createServer((socket) => {
        console.log("-USUARIO CONECTADO")
    
        //Recepcion de puntos
        socket.on('data', (data) => {
            
            console.log("-DATOS RECIBIDOS: " + data.toString())
            
            //Split de los datos recibidos. Formato: cordx;cordy;shash;bs
            msg = data.toString().split(";")
            cordx = msg[0]
            cordy = msg[1]
            shash = msg[2]
            bs = msg[3]
    
            if(bs !== "Error"){
    
                //Verificar la firma
                //Si bs^e = hash entonces se verifica la firma
                isVerified = bigInt(bs,16).modPow(e,n).equals(bigInt(shash,16))
    
                //Muestra por consola (Uso para test)
                console.log("-VERIFICACION: " + isVerified)
    
                //Si la fimra es valida entonces guardamos el punto en el diccionario
                //Clave: hash firmado, Valor: Punto
                if(isVerified){
                    //Confirmar la recepcion del mensaje con el cliente
                    socket.write("Recibido")
                    puntos[bs] = [[parseInt(cordx), parseInt(cordy)]]
                    auxpoints[bs] = [[parseInt(cordx), parseInt(cordy)]]
                    console.log("-PUNTOS: " + JSON.stringify(puntos))
                }else
                {
                    socket.write("Firma incorrecta")
                }
            }else
            {
                socket.write("Error votante no censado o duplicado")
            }
    
        });
    
        //Desconexion del usuario
        socket.on('close', () => {
            console.log("-USUARIO DESCONECTADO");
        });
    });
    
    //Escucha en el puerto PORT
    partido.listen(2000, () => {
        console.log("-SERVIDOR TCP INICIADO EN EL PUERTO 2000")
    });
    
    //Servidor del partido a partido
    const conexionInterna = net.createServer((socket) => {
    
        //Recepcion de los diccionarios de los otros partidos con los puntos
        socket.on('data', (data) => {
            data = JSON.parse(data)
            for (const key in data) {
                if (key in puntos) {
                  auxpoints[key] = auxpoints[key].concat(data[key])
                } else {
                  auxpoints[key] = data[key]
                }
            }
            //Confirmacion de recepcion
            socket.write("Recibido")
            receptions++
    
            //Si ya hemos recibido los puntos de los otros partidos esperamos 5 segundos y cerramos conexion
            if(receptions == listIP.length - 1){
                setTimeout(function(){
                    conexionInterna.close()
                }, 5000);
            }
        });
    
        //Desconexion de cada partido
        socket.on('close', () => {
            console.log("-DATOS RECIBIDOS DE TODOS LOS PARTIDOS")
        });
    });
    
    //Cierre de conexion entre partidos
    conexionInterna.on('close', () => {
        //Aviso por consola de la finalización de la conexión con los partidos 
        console.log("-FIN DE CONEXION ENTRE PARTIDOS")
    
        //Igualamos el diccionario de puntos original al que se usa para compartir
        puntos = auxpoints
        console.log("-PUNTOS COMPLETOS: " + JSON.stringify(puntos))
    
        //Calculamos la interpolacion de lagrange para cada entrada del diccionario
        for(const key in puntos){
            res = Math.round(interpolate(puntos[key],0)).toString(16)
            if(res.length % 2 !== 0){
                res = "0" + res
            }
            res = Buffer.from(res, 'hex').toString('base64')

            fs.appendFileSync('../Volumenes/PBB_Partidos.txt', "Certificado: " + key + " Puntos: " + puntos[key] + " Voto: " + res +"\n")

            //Si ya existe una entrada para el partido en el conteo sumamos un voto si no la inicializamos a 1
            if(res in conteo){
                conteo[res]++
            }else{
                conteo[res] = 1
            }
        }

        fs.truncateSync('../Volumenes/IpContainer.txt')
    
        //Resultado del conteo de votos
        console.log("Resultado")
        console.log("--------------------------------")
        console.log(conteo)
    });
    
    //Escucha en el puerto PORTP
    conexionInterna.listen(3000, () => {
        console.log("-SERVIDOR TCP INICIADO EN EL PUERTO 3000")
    });
    
    //Cierre del servidor de conexion usuario partido
    const intervalId = setInterval(() => {
    
        //hora actual
        const now = new Date();
        const hours = now.getHours().toString()
        const minutes = now.getMinutes().toString()
    
        //Si la hora actual es igual a la indicada se procede al cierre
        if (hours === horaFin && minutes === minFin) {
          partido.close(() => {
            clearInterval(intervalId);
            console.log("-SERVIDOR CERRADO");
            partieToPartie()
          });
        }
    }, 10000);//Comprobacion cada segundo
}, 2500);