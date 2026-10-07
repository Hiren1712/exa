# ============================================================
# Stage 1: Build JAR với Maven
# ============================================================
FROM maven:3.9-eclipse-temurin-21-alpine AS builder

WORKDIR /build

# Copy pom.xml trước để cache dependencies
COPY pom.xml .
RUN mvn -B dependency:go-offline -DskipTests

# Copy source và build
COPY src ./src
RUN mvn -B clean package -DskipTests

# ============================================================
# Stage 2: Runtime image (JRE nhẹ)
# ============================================================
FROM eclipse-temurin:21-jre-alpine

# Cài curl cho healthcheck
RUN apk add --no-cache curl tzdata

# Set timezone VN
ENV TZ=Asia/Ho_Chi_Minh
RUN cp /usr/share/zoneinfo/Asia/Ho_Chi_Minh /etc/localtime && \
    echo "Asia/Ho_Chi_Minh" > /etc/timezone

# Tạo user non-root
RUN addgroup -S exa && adduser -S exa -G exa

WORKDIR /app

# Copy JAR
COPY --from=builder /build/target/exa-backend.jar app.jar

# Uploads directory
RUN mkdir -p /app/uploads && chown -R exa:exa /app

USER exa

EXPOSE 8080

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8080/api/actuator/health || exit 1

# JVM tuning cho VPS 2GB
ENTRYPOINT ["java", \
    "-XX:+UseContainerSupport", \
    "-XX:MaxRAMPercentage=70", \
    "-XX:+UseG1GC", \
    "-XX:+OptimizeStringConcat", \
    "-Djava.security.egd=file:/dev/./urandom", \
    "-Duser.timezone=Asia/Ho_Chi_Minh", \
    "-jar", "app.jar"]