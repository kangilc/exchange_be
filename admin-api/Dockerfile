# Stage 1: Build the application using Gradle
FROM gradle:7.6.0-jdk17 AS build
WORKDIR /home/gradle/project

# Copy Gradle configuration files
COPY build.gradle settings.gradle ./

# Copy admin-api source code
COPY admin-api ./admin-api

# Build the admin-api subproject
RUN gradle :admin-api:build -x test --no-daemon

# Stage 2: Runtime JRE image
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /home/gradle/project/admin-api/build/libs/admin-api-1.0.0.jar ./app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]
