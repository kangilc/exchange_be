# Stage 1: Build the admin-api subproject
FROM gradle:7.6.0-jdk17 AS build
WORKDIR /home/gradle/project
COPY build.gradle settings.gradle ./
COPY admin-api ./admin-api
RUN gradle :admin-api:bootJar -x test --no-daemon

# Stage 2: Run in JRE runtime
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /home/gradle/project/admin-api/build/libs/admin-api-1.0.0.jar ./app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]
