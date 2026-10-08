package vn.exa.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "user_profile_media")
@Getter
@Setter
@NoArgsConstructor
public class UserProfileMedia {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @Lob
    @Column(name = "avatar_data", columnDefinition = "LONGBLOB")
    private byte[] avatarData;

    @Column(name = "avatar_content_type", length = 100)
    private String avatarContentType;

    @Lob
    @Column(name = "cover_data", columnDefinition = "LONGBLOB")
    private byte[] coverData;

    @Column(name = "cover_content_type", length = 100)
    private String coverContentType;
}
