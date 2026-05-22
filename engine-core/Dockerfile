# Stage 1: Build the engine-core subproject
FROM gradle:7.6.0-jdk17 AS build
WORKDIR /home/gradle/project
COPY build.gradle settings.gradle ./
COPY engine-core ./engine-core
RUN gradle :engine-core:build -x test --no-daemon

# Stage 2: Execute in minimal JVM runtime
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /home/gradle/project/engine-core/build/libs/*.jar app.jar
ENV JAVA_OPTS="-XX:+UseZGC -XX:+AlwaysPreTouch -XX:MaxGCPauseMillis=1"
EXPOSE 9999 9998
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
