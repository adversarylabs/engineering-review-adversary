use app::job::{pause, JobState};

#[test]
fn running_job_can_pause() {
    let mut state = JobState::Running;
    pause(&mut state).unwrap();
    assert_eq!(state, JobState::Paused);
}
