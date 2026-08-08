// Example of defective nil-guard (incomplete contract).
// The guard inside set_version (and init) can only execute when spec is already absent.
#[derive(Default)]
struct Spec {
    version: String,
}

struct Generator {
    spec: Option<Spec>,
}

impl Generator {
    fn init_config(&mut self) {
        if self.spec.is_none() {
            self.spec = Some(Spec::default());
        }
    }

    // Vulnerable pattern: conditional call means the guard "only fires if" already nil.
    fn set_version_vulnerable(&mut self, v: &str) {
        if self.spec.is_none() {
            self.init_config();
        }
        if let Some(s) = &mut self.spec {
            s.version = v.to_string();
        }
    }

    // Clean pattern for contrast (unconditional init from public entry).
    fn set_version_clean(&mut self, v: &str) {
        self.init_config();
        if let Some(s) = &mut self.spec {
            s.version = v.to_string();
        }
    }
}