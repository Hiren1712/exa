package vn.exa.submission;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProctorEventRepository extends JpaRepository<ProctorEvent, Long> {

    List<ProctorEvent> findBySubmissionIdOrderByOccurredAtDesc(Long submissionId);

    long countBySubmissionIdAndEventType(Long submissionId, ProctorEvent.EventType eventType);
}