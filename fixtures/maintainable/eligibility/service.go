package eligibility

import (
	"context"
	"errors"
)

var ErrIneligible = errors.New("account is not eligible")

type Account struct {
	Active  bool
	Country string
}

type Store interface {
	Account(context.Context, string) (Account, error)
}

type Service struct {
	store Store
}

func NewService(store Store) *Service {
	return &Service{store: store}
}

func (s *Service) Preview(ctx context.Context, accountID string) (bool, error) {
	account, err := s.store.Account(ctx, accountID)
	if err != nil {
		return false, err
	}
	return account.Active && account.Country != "blocked", nil
}

func (s *Service) Apply(ctx context.Context, accountID string) error {
	account, err := s.store.Account(ctx, accountID)
	if err != nil {
		return err
	}
	if !account.Active || account.Country == "blocked" {
		return ErrIneligible
	}
	return nil
}
