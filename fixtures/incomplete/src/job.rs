#[derive(Clone, Debug, PartialEq)]
pub enum JobState {
    Queued,
    Running,
    Paused,
    Complete,
}

pub fn can_start(state: &JobState) -> bool {
    matches!(state, JobState::Queued)
}

pub fn pause(state: &mut JobState) -> Result<(), &'static str> {
    if *state != JobState::Running {
        return Err("only running jobs can be paused");
    }
    *state = JobState::Paused;
    Ok(())
}
