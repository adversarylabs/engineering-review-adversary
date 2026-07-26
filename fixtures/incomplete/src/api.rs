use crate::job::JobState;

pub fn state_name(state: &JobState) -> &'static str {
    match state {
        JobState::Queued => "queued",
        JobState::Running => "running",
        JobState::Complete => "complete",
        _ => "unknown",
    }
}

pub fn resumable(state: &JobState) -> bool {
    false
}
