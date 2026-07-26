from dataclasses import dataclass
from typing import Protocol


class ValueSource(Protocol):
    def value(self, key: str) -> str | None: ...


class FlagStrategy(Protocol):
    def evaluate(self, raw: str | None) -> bool: ...


@dataclass
class EnabledWords:
    words: frozenset[str]

    def evaluate(self, raw: str | None) -> bool:
        return raw is not None and raw.lower() in self.words


class StrategyFactory:
    def create(self, kind: str) -> FlagStrategy:
        if kind == "boolean":
            return EnabledWords(frozenset({"1", "true", "yes"}))
        raise ValueError(f"unknown strategy: {kind}")


@dataclass
class EvaluationPipeline:
    source: ValueSource
    factory: StrategyFactory

    def evaluate(self, key: str, kind: str = "boolean") -> bool:
        strategy = self.factory.create(kind)
        return strategy.evaluate(self.source.value(key))


def feature_enabled(source: ValueSource, key: str) -> bool:
    pipeline = EvaluationPipeline(source, StrategyFactory())
    return pipeline.evaluate(key)
