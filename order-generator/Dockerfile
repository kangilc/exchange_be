# Stage 1: Build the order-generator subproject
FROM gradle:7.6.0-jdk17 AS build
WORKDIR /home/gradle/project
COPY build.gradle settings.gradle ./
COPY order-generator ./order-generator
RUN gradle :order-generator:build -x test --no-daemon

# Stage 2: Run in minimal JVM runtime
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /home/gradle/project/order-generator/build/libs/*.jar app.jar
ENTRYPOINT ["sh", "-c", "java -jar app.jar"]
