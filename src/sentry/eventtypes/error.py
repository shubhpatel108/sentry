from __future__ import absolute_import

from sentry.utils.safe import trim

from .base import BaseEvent


class ErrorEvent(BaseEvent):
    key = 'error'

    def has_metadata(self):
        return 'sentry.interfaces.Exception' in self.data

    def get_metadata(self):
        exception = self.data['sentry.interfaces.Exception']['values'][-1]

        # in some situations clients are submitting non-string data for these
        return {
            'type': trim(exception.get('type', 'Error'), 128),
            'value': trim(exception.get('value', ''), 1024),
        }

    def to_string(self, data):
        return u'{}: {}'.format(data['type'], data['value'])
