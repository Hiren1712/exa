package vn.exa.submission;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProctorEventRepository extends JpaRepository<ProctorEvent, Long> {

    List<ProctorEvent> findBySubmissionIdOrderByOccurredAtDesc(Long submissionId);

    long countBySubmissionIdAndEventType(Long submissionId, ProctorEvent.EventType eventType);

    @Query("""
            SELECT proctorEvent.submissionId AS submissionId,
                   proctorEvent.eventType AS eventType,
                   COUNT(proctorEvent.id) AS eventCount
            FROM ProctorEvent proctorEvent
            WHERE proctorEvent.submissionId IN :submissionIds
            GROUP BY proctorEvent.submissionId, proctorEvent.eventType
            """)
    List<EventCountProjection> summarizeBySubmissionIds(@Param("submissionIds") List<Long> submissionIds);

    interface EventCountProjection {
        Long getSubmissionId();

        ProctorEvent.EventType getEventType();

        Long getEventCount();
    }
}