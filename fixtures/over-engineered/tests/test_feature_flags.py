from feature_flags import feature_enabled


class Values:
    def __init__(self, values: dict[str, str]):
        self.values = values

    def value(self, key: str) -> str | None:
        return self.values.get(key)


def test_boolean_words():
    assert feature_enabled(Values({"checkout": "yes"}), "checkout")
    assert not feature_enabled(Values({}), "checkout")
