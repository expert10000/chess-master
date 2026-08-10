# v0.9.9 — Goal-Based Training Plans

v0.9.9 adds an explicit 4–8 week objective layer above the daily/weekly adaptive coach.

## Supported goal types

### 1. Improve an opening

Example:

`Improve French Defense · Advance`

The opening target must already exist in either:

- Training Analytics opening history; or
- saved repertoire memory.

The plan records a 14-day opening-recall baseline and creates an explicit accuracy, practice-volume, active-day, and stable-card target.

### 2. Reduce a recurring weakness

Example:

`Reduce Missed tactics`

The weakness target comes from actual trained/observed weakness categories.

The plan records a 14-day baseline and gives the selected weakness a strong Daily Study selection multiplier.

### 3. Prepare toward a rating

Example:

`Prepare toward 2200`

This is deliberately a **preparation goal**, not an Elo predictor.

The app does not know that completing exercises makes a player's actual federation/server rating equal to 2200.

Instead it measures a transparent **Training Readiness** proxy from:

- recent 30-day training accuracy;
- active training days;
- average exercise points;
- number of stable spaced-repetition cards.

The target rating is therefore the user's motivation/goal label; measurable progress is based on training readiness.

## Plan duration

The user chooses:

- 4 weeks
- 6 weeks
- 8 weeks

Only one goal is primary/active at a time.

Creating another goal pauses the previous one. Paused goals remain in recent history and can be resumed.

## Baseline

At plan creation the app freezes a baseline.

For opening/weakness goals:

- relevant attempts in the prior 14 days;
- relevant accuracy;
- average points;
- active days;
- stable relevant cards.

For rating preparation:

- all training attempts in the prior 30 days;
- overall training readiness;
- stable cards.

If no reliable historical attempts exist, the baseline is shown as missing rather than invented.

## Automatic targets

Opening goal defaults:

- target accuracy: at least 85%, normally baseline + 12 pp, capped at 95%;
- 8 focused attempts/week;
- 3 active days/week;
- +2 stable cards, with a minimum stable-card target of 4.

Weakness goal:

- target accuracy: at least 82%, normally baseline + 15 pp, capped at 93%;
- 10 focused attempts/week;
- 4 active days/week;
- +2 stable cards, minimum target 4.

Rating-preparation goal:

- target readiness: at least 78/100, normally baseline + 15, capped at 90;
- 18 training attempts/week;
- 4 active days/week;
- +4 stable cards, minimum target 12.

## Milestones

Every week is assigned one of four phases:

1. **Baseline & diagnosis**
2. **Focused repetition**
3. **Mixed application**
4. **Consolidation**

A 4-week goal visits each phase quickly.

A 6- or 8-week goal gives more weeks to focused repetition and mixed application before consolidation.

The dashboard shows:

- current week;
- weekly attempt target;
- target-accuracy trajectory for opening/weakness goals;
- current phase description.

## Measured progress

Opening/weakness progress combines:

- 50% accuracy progress;
- 25% practice volume;
- 15% active-day consistency;
- 10% stable-card growth.

Rating-preparation progress combines:

- 55% Training Readiness;
- 25% practice volume;
- 15% active-day consistency;
- 5% stable-card growth.

The dashboard also shows expected progress based on elapsed calendar time and labels the plan:

- Ahead
- On track
- Behind
- Insufficient data

## Daily Study integration

The active goal produces explicit planner multipliers.

Opening/weakness goal:

`target label ×1.70`

Rating preparation:

- top recurring weakness ×1.35;
- second ×1.25;
- third ×1.15.

These combine with v0.9.8 weekly trend multipliers but are capped to avoid runaway weighting.

Goal focus can reorder:

- eligible due repertoire within overdue-urgency bands;
- top weakness categories before round-robin sampling;
- new material inside the existing small novelty cap.

Goal focus **cannot**:

- change Stockfish verdicts;
- change spaced-repetition due timestamps;
- exceed the new-material cap;
- displace much more severely overdue material;
- manufacture opening/weakness training positions that do not exist.

## Persistence

Goal state is stored locally:

`stockfish-coach.goal-plans.v1`

Up to 24 recent goals are kept.

A goal can be:

- Active
- Paused
- Completed

The Goal-Based Training dashboard provides Create, Pause, Resume, and Complete & archive actions.
