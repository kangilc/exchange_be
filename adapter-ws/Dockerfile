# Stage 1: Build the adapter-ws subproject
FROM gradle:7.6.0-jdk17 AS build
WORKDIR /home/gradle/project
COPY build.gradle settings.gradle ./
COPY adapter-ws ./adapter-ws
RUN gradle :adapter-ws:build -x test --no-daemon

# Stage 2: Run in minimal JVM runtime
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /home/gradle/project/adapter-ws/build/libs/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["sh", "-c", "java -jar app.jar"]
