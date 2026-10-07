package vn.exa.auth;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmailAndDeletedAtIsNull(String email);

    boolean existsByEmailAndDeletedAtIsNull(String email);

    Optional<User> findByIdAndDeletedAtIsNull(Long id);

    long countByRoleAndDeletedAtIsNull(User.Role role);

    @Query("""
        SELECT u FROM User u
        WHERE u.deletedAt IS NULL
          AND (:role IS NULL OR u.role = :role)
          AND (:keyword IS NULL OR LOWER(u.fullName) LIKE LOWER(CONCAT('%', :keyword, '%'))
                                OR LOWER(u.email) LIKE LOWER(CONCAT('%', :keyword, '%')))
        ORDER BY u.createdAt DESC
    """)
    Page<User> search(@Param("role") User.Role role,
                      @Param("keyword") String keyword,
                      Pageable pageable);
}