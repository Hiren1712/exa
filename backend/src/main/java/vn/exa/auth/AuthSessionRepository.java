package vn.exa.auth;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface AuthSessionRepository extends JpaRepository<AuthSession, String> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM AuthSession s WHERE s.id = :id AND s.user.id = :userId")
    Optional<AuthSession> findByIdAndUserIdForUpdate(
            @Param("id") String id,
            @Param("userId") Long userId);

    Optional<AuthSession> findByIdAndUserId(String id, Long userId);

    List<AuthSession> findByUserIdAndRevokedAtIsNullAndExpiresAtAfterOrderByLastSeenAtDesc(
            Long userId,
            LocalDateTime now);

    boolean existsByIdAndUserIdAndRevokedAtIsNullAndExpiresAtAfter(
            String id,
            Long userId,
            LocalDateTime now);

    long deleteByExpiresAtBefore(LocalDateTime now);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
        UPDATE AuthSession s
        SET s.revokedAt = :now
        WHERE s.user.id = :userId
          AND s.revokedAt IS NULL
          AND s.expiresAt > :now
          AND (:currentSessionId IS NULL OR s.id <> :currentSessionId)
        """)
    int revokeOthers(
            @Param("userId") Long userId,
            @Param("currentSessionId") String currentSessionId,
            @Param("now") LocalDateTime now);
}
