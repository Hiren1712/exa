package vn.exa.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserProfileMediaRepository extends JpaRepository<UserProfileMedia, Long> {
}
