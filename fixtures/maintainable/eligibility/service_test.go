package eligibility

import (
	"context"
	"errors"
	"testing"
)

type fakeStore struct {
	account Account
}

func (s fakeStore) Account(context.Context, string) (Account, error) {
	return s.account, nil
}

func TestPreviewAndApplyAgree(t *testing.T) {
	service := NewService(fakeStore{account: Account{Active: false, Country: "us"}})
	eligible, err := service.Preview(context.Background(), "a-1")
	if err != nil || eligible {
		t.Fatalf("unexpected preview: eligible=%v err=%v", eligible, err)
	}
	if !errors.Is(service.Apply(context.Background(), "a-1"), ErrIneligible) {
		t.Fatal("apply should reject the same account")
	}
}
