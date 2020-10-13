{{/* vim: set filetype=mustache: */}}
{{/*
Expand the name of the chart.
*/}}
{{- define "daily-api.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "daily-api.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "daily-api.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "daily-api.checksum" }}
checksum/secret: {{ include (print $.Template.BasePath "/secret.yaml") . | sha256sum }}
checksum/files: {{ include (print $.Template.BasePath "/secret-files.yaml") . | sha256sum }}
checksum/configmap: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}
{{- end }}

{{- define "daily-api.config" }}
{{- $fullName := include "daily-api.fullname" . -}}
- name: NODE_ENV
  value: production
- name: TYPEORM_USERNAME
  valueFrom:
    secretKeyRef:
      name: {{ $fullName }}
      key: TYPEORM_USERNAME
- name: TYPEORM_PASSWORD
  valueFrom:
    secretKeyRef:
      name: {{ $fullName }}
      key: TYPEORM_PASSWORD
- name: TYPEORM_DATABASE
  valueFrom:
    secretKeyRef:
      name: {{ $fullName }}
      key: TYPEORM_DATABASE
- name: TYPEORM_HOST
  valueFrom:
    secretKeyRef:
      name: {{ $fullName }}
      key: TYPEORM_HOST
- name: URL_PREFIX
  valueFrom:
    configMapKeyRef:
      name: {{ $fullName }}
      key: URL_PREFIX
- name: SLACK_WEBHOOK
  valueFrom:
    secretKeyRef:
      name: {{ $fullName }}
      key: SLACK_WEBHOOK
- name: DEFAULT_IMAGE_URL
  valueFrom:
    configMapKeyRef:
      name: {{ $fullName }}
      key: DEFAULT_IMAGE_URL
- name: DEFAULT_IMAGE_PLACEHOLDER
  valueFrom:
    configMapKeyRef:
      name: {{ $fullName }}
      key: DEFAULT_IMAGE_PLACEHOLDER
- name: DEFAULT_IMAGE_RATIO
  valueFrom:
    configMapKeyRef:
      name: {{ $fullName }}
      key: DEFAULT_IMAGE_RATIO
- name: ACCESS_SECRET
  valueFrom:
    secretKeyRef:
      name: {{ $fullName }}
      key: ACCESS_SECRET
- name: GATEWAY_SECRET
  valueFrom:
    secretKeyRef:
      name: {{ $fullName }}
      key: GATEWAY_SECRET
- name: GATEWAY_URL
  valueFrom:
    configMapKeyRef:
      name: {{ $fullName }}
      key: GATEWAY_URL
- name: CLOUDINARY_URL
  valueFrom:
    secretKeyRef:
      name: {{ $fullName }}
      key: CLOUDINARY_URL
- name: SUPERFEEDR_USER
  valueFrom:
    secretKeyRef:
      name: {{ $fullName }}
      key: SUPERFEEDR_USER
- name: SUPERFEEDR_PASS
  valueFrom:
    secretKeyRef:
      name: {{ $fullName }}
      key: SUPERFEEDR_PASS
- name: WEBHOOK_URL
  valueFrom:
    secretKeyRef:
      name: {{ $fullName }}
      key: WEBHOOK_URL
- name: WEBHOOK_SECRET
  valueFrom:
    secretKeyRef:
      name: {{ $fullName }}
      key: WEBHOOK_SECRET
- name: ALGOLIA_APP
  valueFrom:
    secretKeyRef:
      name: {{ $fullName }}
      key: ALGOLIA_APP
- name: ALGOLIA_KEY
  valueFrom:
    secretKeyRef:
      name: {{ $fullName }}
      key: ALGOLIA_KEY
- name: TWITTER_CONSUMER_KEY
  valueFrom:
    secretKeyRef:
      name: {{  $fullName }}
      key: TWITTER_CONSUMER_KEY
- name: TWITTER_CONSUMER_SECRET
  valueFrom:
    secretKeyRef:
      name: {{  $fullName }}
      key: TWITTER_CONSUMER_SECRET
- name: TWITTER_ACCESS_TOKEN_KEY
  valueFrom:
    secretKeyRef:
      name: {{  $fullName }}
      key: TWITTER_ACCESS_TOKEN_KEY
- name: TWITTER_ACCESS_TOKEN_SECRET
  valueFrom:
    secretKeyRef:
      name: {{  $fullName }}
      key: TWITTER_ACCESS_TOKEN_SECRET
- name: WEBFLOW_TOKEN
  valueFrom:
    secretKeyRef:
      name: {{  $fullName }}
      key: WEBFLOW_TOKEN
- name: COMMENTS_PREFIX
  valueFrom:
    configMapKeyRef:
      name: {{ $fullName }}
      key: COMMENTS_PREFIX
- name: SENDGRID_API_KEY
  valueFrom:
    secretKeyRef:
      name: {{  $fullName }}
      key: SENDGRID_API_KEY
- name: COOKIES_KEY
  valueFrom:
    secretKeyRef:
      name: {{  $fullName }}
      key: COOKIES_KEY
- name: JWT_SECRET
  valueFrom:
    secretKeyRef:
      name: {{  $fullName }}
      key: JWT_SECRET
- name: JWT_AUDIENCE
  valueFrom:
    secretKeyRef:
      name: {{  $fullName }}
      key: JWT_AUDIENCE
- name: JWT_ISSUER
  valueFrom:
    secretKeyRef:
      name: {{  $fullName }}
      key: JWT_ISSUER
- name: HASHNODE_WEBHOOK
  valueFrom:
    secretKeyRef:
      name: {{  $fullName }}
      key: HASHNODE_WEBHOOK
{{- end }}
