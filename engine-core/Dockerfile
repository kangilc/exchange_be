# -----------------------------------------------------------------------------
# Stage 1: 애플리케이션 빌드 단계 (Gradle 환경)
# -----------------------------------------------------------------------------
# JDK 17 및 Gradle 7.6.0 기반의 경량 빌드 이미지 사용
FROM gradle:7.6.0-jdk17 AS build

# 소스 코드 빌드를 위한 작업 디렉토리 설정
WORKDIR /home/gradle/project

# Gradle 의존성 확인 및 라이브러리 캐싱 극대화를 위해 빌드 명세 파일 먼저 복사
COPY build.gradle settings.gradle ./

# 매칭 엔진 서브프로젝트 폴더 통째 복사
COPY engine-core ./engine-core

# 테스트 실행을 건너뛰고(-x test) 데몬 생성 없이 무점유 빌드 수행
RUN gradle :engine-core:build -x test --no-daemon

# -----------------------------------------------------------------------------
# Stage 2: 런타임 이미지 슬리밍 및 최소 JVM 구동 환경 설정
# -----------------------------------------------------------------------------
# 컨테이너 용량을 최소화한 알파인 리눅스 기반의 JRE 17 런타임 이미지 적용
FROM eclipse-temurin:17-jre-alpine

# 실행용 작업 디렉토리 지정
WORKDIR /app

# 빌드 스테이지에서 패키징 완료된 매칭 엔진 JAR 파일을 app.jar라는 이름으로 안전 복사
COPY --from=build /home/gradle/project/engine-core/build/libs/*.jar app.jar

# 레이턴시 민감 마이크로서비스용 JVM 초저지연 GC 설정:
# - -XX:+UseZGC: 대용량 힙에서도 GC 일시 정지(Stop-The-World)를 최소화하는 Z 가비지 컬렉터 활성화
# - -XX:+AlwaysPreTouch: 기동 시 힙 메모리 공간을 실제 메모리에 미리 맵핑하여 런타임 시점의 성능 저하 방지
# - -XX:MaxGCPauseMillis=1: 최대 GC 중단 목표 지연 시간을 1ms로 조율
ENV JAVA_OPTS="-XX:+UseZGC -XX:+AlwaysPreTouch -XX:MaxGCPauseMillis=1"

# 매칭 엔진이 사용하는 인바운드 포트 노출 명시 (예: WS Gateway 통신 및 외부 요청 대기 등)
EXPOSE 9999 9998

# 지정된 튜닝 옵션과 함께 최적화된 자바 프로세스 구동
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
