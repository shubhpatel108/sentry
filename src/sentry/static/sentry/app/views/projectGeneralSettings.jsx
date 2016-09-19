import React from 'react';

import ApiMixin from '../mixins/apiMixin';
import LoadingIndicator from '../components/loadingIndicator';
import ProjectState from '../mixins/projectState';
import {GenericField} from '../components/forms';
import {t, tct} from '../locale';

const FIELDS = {
  name: {
    name: 'name',
    type: 'string',
    label: t('Project name'),
    placeholder: 'e.g. My Service Name',
  },
  slug: {
    name: 'slug',
    type: 'string',
    label: t('Short name'),
    help: t('A unique ID used to identify this project.'),
  },
  team: {
    name: 'team',
    type: 'choice',
    label: t('Team'),
    choices: [],
  },
  mail_subject_prefix: {
    name: 'mail_subject_prefix',
    type: 'string',
    label: t('Subject prefix'),
    help: t('Choose a custom prefix for emails from this project.'),
    required: false,
  },
  default_environment: {
    name: 'default_environment',
    type: 'string',
    label: t('Default environment'),
    placeholder: 'e.g. production',
    help: t('The default selected environment when viewing issues.'),
    required: false,
  },
  resolve_age: {
    name: 'resolve_age',
    type: 'range',
    label: t('Auto resolve'),
    help: t('Automatically resolve an issue if it hasn\'t been seen for this amount of time.'),
    min: 0,
    max: 168,
    step: 1,
    allowedValues: (() => {
      let i = 0;
      let values = [];
      while (i <= 168) {
        values.push(i);
        if (i < 12) {
          i += 1;
        } else if (i < 24) {
          i += 3;
        } else if (i < 36) {
          i += 6;
        } else if (i < 48) {
          i += 12;
        } else {
          i += 24;
        }
      }
      return values;
    })(),
    formatLabel: (val) => {
      val = parseInt(val, 10);
      if (val === 0) {
          return 'Disabled';
      } else if (val > 23 && val % 24 === 0) {
          val = (val / 24);
          return val + ' day' + (val != 1 ? 's' : '');
      }
      return val + ' hour' + (val != 1 ? 's' : '');
    },
    required: false,
  },
  scrub_data: {
    name: 'scrub_data',
    type: 'boolean',
    label: t('Data scrubber'),
    help: t('Enable server-side data scrubbing.'),
    required: false,
  },
  scrub_defaults: {
    name: 'scrub_defaults',
    type: 'boolean',
    label: t('Use default scrubbers'),
    help: t('Apply default scrubbers to prevent things like passwords and credit cards from being stored.'),
    required: false,
  },
  sensitive_fields: {
    name: 'sensitive_fields',
    type: 'textarea',
    label: t('Additional sensitive fields'),
    help: t('Additional field names to match against when scrubbing data. Separate multiple entries with a newline.'),
    placeholder: t('e.g. email'),
    required: false,
  },
  safe_fields: {
    name: 'safe_fields',
    type: 'textarea',
    label: t('Safe fields'),
    help: t('Field names which data scrubbers should ignore. Separate multiple entries with a newline.'),
    placeholder: t('e.g. email'),
    required: false,
  },
  scrub_ip_address: {
    name: 'scrub_ip_address',
    type: 'boolean',
    label: t('Don\'t store IP Addresses'),
    help: t('Prevent IP addresses from being stored for new events.'),
    placeholder: t('e.g. email'),
    required: false,
  },
  origins: {
    name: 'origins',
    type: 'textarea',
    label: t('Allowed domains'),
    help: t('Separate multiple entries with a newline.'),
    placeholder: t('e.g. https://example.com'),
    required: false,
  },
  token: {
    name: 'token',
    type: 'string',
    label: t('Security token'),
    help: t('Outbound requests matching Allowed Domains will have the header "X-Sentry-Token: {token}" appended.'),
    required: false,
  },
  blacklisted_ips: {
    name: 'blacklisted_ips',
    type: 'textarea',
    label: t('Filtered IP addresses'),
    help: t('Separate multiple entries with a newline.'),
    required: false,
    placeholder: t('e.g. 127.0.0.1 or 192.168.0.1/24')
  },
  scrape_javascript: {
    name: 'scrape_javascript',
    type: 'boolean',
    label: t('Enable JavaScript source fetching'),
    help: t('Allow Sentry to scrape missing JavaScript source context when possible.'),
    required: false,
  },
};


const ProjectGeneralSettings = React.createClass({
  propTypes: {
    project: React.PropTypes.object.isRequired,
  },

  mixins: [ApiMixin, ProjectState],

  getInitialState() {
    let project = this.props.project;
    let initialData = {
      name: project.name,
      slug: project.slug,
      origins: project.options['sentry:origins'],
      resolve_age: project.options['sentry:resolve_age'],
      scrub_data: project.options['sentry:scrub_data'],
      scrub_defaults: project.options['sentry:scrub_defaults'],
      sensitive_fields: project.options['sentry:sensitive_fields'],
      safe_fields: project.options['sentry:safe_fields'],
      default_environment: project.options['sentry:default_environment'],
      mail_subject_prefix: project.options['mail:subject_prefix'],
      scrub_ip_address: project.options['sentry:scrub_ip_address'],
      token: project.securityToken,
      scrape_javascript: project.options['sentry:scrape_javascript'],
      blacklisted_ips: project.options['sentry:blacklisted_ips'],
    };

    return {
      loading: false,
      error: false,

      initialData: initialData,
      formData: {...initialData},
      errors: {},
    };
  },

  componentWillReceiveProps(nextProps) {
    let location = this.props.location;
    let nextLocation = nextProps.location;
    if (location.pathname != nextLocation.pathname || location.search != nextLocation.search) {
      this.remountComponent();
    }
  },

  remountComponent() {
    this.setState(this.getInitialState(), this.fetchData);
  },

  changeField(name, value) {
    // upon changing a field, remove errors
    let errors = this.state.errors;
    delete errors[name];
    this.setState({formData: {
      ...this.state.formData,
      [name]: value,
    }, errors: errors});
  },

  getEndpoint() {
    let {orgId, projectId} = this.props.params;
    return `/projects/${orgId}/${projectId}/`;
  },

  onSubmit() {
    this.api.request(this.getEndpoint(), {
      data: this.state.formData,
      method: 'PUT',
      success: this.onSaveSuccess.bind(this, data => {
        let formData = {};
        data.config.forEach((field) => {
          formData[field.name] = field.value || field.defaultValue;
        });
        this.setState({
          formData: formData,
          initialData: Object.assign({}, formData),
          errors: {}
        });
      }),
      error: this.onSaveError.bind(this, error => {
        this.setState({
          errors: (error.responseJSON || {}).errors || {},
        });
      }),
      complete: this.onSaveComplete
    });
  },

  renderLoading() {
    return (
      <div className="box">
        <LoadingIndicator />
      </div>
    );
  },

  renderField(name) {
    let field = FIELDS[name];
    if (name === 'team') {
      field = {
        ...field,
        choices: this.getOrganization().teams
          .filter(o => o.isMember)
          .map(o => [o.id, o.slug]),
      };
      if (field.choices.length === 1)
        return null;
    }

    return (
      <GenericField
        config={field}
        formData={this.state.formData}
        formErrors={this.state.errors}
        onChange={this.changeField.bind(this, field.name)} />
    );
  },

  render() {
    if (this.state.loading)
      return this.renderLoading();

    return (
      <div>
        <h2>{t('Project Settings')}</h2>

          <form className="form-stacked">
            <div className="box">
              <div className="box-header">
              <h3>{t('Project Details')}</h3>
            </div>
            <div className="box-content with-padding">
              {this.renderField('name')}
              {this.renderField('slug')}
              {this.renderField('team')}
            </div>
          </div>

          <div className="box">
            <div className="box-header">
              <h3>{t('Email')}</h3>
            </div>
            <div className="box-content with-padding">
              {this.renderField('mail_subject_prefix')}
            </div>
          </div>

          <div className="box">
            <div className="box-header">
              <h3>{t('Event Settings')}</h3>
            </div>
            <div className="box-content with-padding">
              {this.renderField('default_environment')}
              {this.renderField('resolve_age')}
              <p><small><strong>Note: Enabling auto resolve will immediately resolve anything that has not been seen within this period of time. There is no undo!</strong></small></p>
            </div>
          </div>

          <div className="box">
            <div className="box-header">
              <h3>{t('Data Privacy')}</h3>
            </div>
            <div className="box-content with-padding">
              {this.renderField('scrub_data')}
              {this.renderField('scrub_defaults')}
              {this.renderField('sensitive_fields')}
              {this.renderField('safe_fields')}
              {this.renderField('scrub_ip_address')}
            </div>
          </div>

          <div className="box">
            <div className="box-header">
              <h3>{t('Client Security')}</h3>
            </div>
            <div className="box-content with-padding">

              <p>{tct('Configure origin URLs which Sentry should accept events from. This is used for communication with clients like [link].', {
                link: <a href="https://github.com/getsentry/raven-js">raven-js</a>
              })} {tct('This will restrict requests based on the [Origin] and [Referer] headers.', {
                Origin: <code>Origin</code>,
                Referer: <code>Referer</code>,
              })}</p>
              {this.renderField('origins')}
              {this.renderField('scrape_javascript')}
              {this.renderField('token')}
              {this.renderField('blacklisted_ips')}
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary btn-lg">{t('Save Changes')}</button>
          </div>
        </form>
      </div>
    );
  }
});

export default ProjectGeneralSettings;
