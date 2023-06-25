# Seleccionar la imagen base de Node.js
FROM node:latest

# Establecer el directorio de trabajo
WORKDIR /uservoting

# Copiar los archivos de la aplicación
COPY User.js ./
COPY public_key.pem ./

# Instalar las dependencias
RUN npm install big-integer

# Establecer el comando por defecto para iniciar la aplicación
ENTRYPOINT [ "node", "User.js" ]