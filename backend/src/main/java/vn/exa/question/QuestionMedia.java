package vn.exa.question;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "question_media")
@Getter @Setter
public class QuestionMedia {
    @Id @Column(length = 36)
    private String id;
    @Column(name = "owner_id", nullable = false)
    private Long ownerId;
    @Column(name = "mime_type", nullable = false, length = 30)
    private String mimeType;
    @Lob @Column(name = "image_data", nullable = false, columnDefinition = "LONGBLOB")
    private byte[] imageData;
}
