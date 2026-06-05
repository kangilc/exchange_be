# Run in JRE runtime using host-built jar
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY admin-api/build/libs/admin-api-1.0.0.jar ./app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]

