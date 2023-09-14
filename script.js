'use strict';

let map;
let mapEvent;

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;

  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }

  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

///////////////////////////////////////////////////////////////////
// APPLICATION ARCHITECTURE

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const editForm = document.querySelector('.form__btn--edit');
const deleteForm = document.querySelector('.form__btn--delete');
const deleteAllForm = document.querySelector('.form__btn--deleteAll');
let editing = false;

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];

  constructor() {
    // get user's position
    this._getPosition();

    // get data from local storage
    this._getLocalStorage();

    // attach event handlers
    form.addEventListener('submit', e => {
      if (editing) {
        console.log('edit');
        this._updateWorkout(e);
        editing = false;
      } else {
        this._newWorkout(e);
      }
    });

    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));

    deleteAllForm.addEventListener('click', () => this.reset());
  }

  _getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your position');
        }
      );
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;
    console.log(`https://www.google.pt/maps/@${latitude},${longitude}`);

    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // handling clicks on map
    this.#map.on('click', this._showForm.bind(this));

    this.#workouts.forEach(work => {
      this._renderWorkoutMarker(work);
    });
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    // empty inputs
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';
    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    e.preventDefault();

    // get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    // if workout running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;
      // check if data is valid
      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        return alert('Inputs have to be positive numbers!');

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    // if workout cycling. create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;
      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      )
        return alert('Inputs have to be positive numbers!');
      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    // add new object to workout array
    this.#workouts.push(workout);

    // render workout on map as a marker
    this._renderWorkoutMarker(workout);

    // render workout on list
    this._renderWorkout(workout);

    // hide form and clear input fields
    this._hideForm();

    // set local storage to all workouts
    this._setLocalStorage();
  }

  _updateWorkout(e) {
    e.preventDefault();
    // Get the workout ID from the form dataset
    const workoutId = form.dataset.id;

    // Find the workout object in the array based on the ID
    const workout = this.#workouts.find(work => work.id === workoutId);

    if (!workout) return;

    // Update the workout object with the new form data
    workout.distance = +inputDistance.value;
    workout.duration = +inputDuration.value;

    if (inputType.value === 'running') {
      workout.cadence = +inputCadence.value;
    }

    if (inputType.value === 'cycling') {
      workout.elevationGain = +inputElevation.value;
    }

    // Update the workout description
    workout._setDescription();

    // Update the workout marker on the map
    // workout.marker.setPopupContent(
    //   `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
    // );

    // Update the workout details in the workout list
    const workoutElement = containerWorkouts.querySelector(
      `[data-id="${workoutId}"]`
    );
    if (workoutElement) {
      const inputs = workoutElement.querySelectorAll('.workout__value');

      workoutElement.querySelector('.workout__title').textContent =
        workout.description;
      inputs[0].textContent = workout.distance;
      inputs[1].textContent = workout.duration;

      if (workout.type === 'running') {
        inputs[2].textContent = workout.pace.toFixed(1);
        inputs[3].textContent = workout.cadence;
      }

      if (workout.type === 'cycling') {
        inputs[2].textContent = workout.speed.toFixed(1);
        inputs[3].textContent = workout.elevationGain;
        ``;
      }

      if (workout.type !== inputType.value) {
        const workoutIndex = this.#workouts.findIndex(
          work => work.id === workoutId
        );

        if (workoutIndex === -1) return;

        const deletedWorkout = this.#workouts.splice(workoutIndex, 1)[0];

        // Remove the marker from the map
        this.#map.removeLayer(deletedWorkout.marker);

        workoutElement.remove();

        const validInputs = (...inputs) =>
          inputs.every(inp => Number.isFinite(inp));
        const allPositive = (...inputs) => inputs.every(inp => inp > 0);

        let newWorkout;
        const distance = +inputDistance.value;
        const duration = +inputDuration.value;
        const { lat, lng } = workout.coords;

        // if workout running, create running object
        if (inputType.value === 'running') {
          const cadence = +inputCadence.value;
          // check if data is valid
          if (
            !validInputs(distance, duration, cadence) ||
            !allPositive(distance, duration, cadence)
          )
            return alert('Inputs have to be positive numbers!');

          newWorkout = new Running([lat, lng], distance, duration, cadence);
        }

        // if workout cycling. create cycling object
        if (inputType.value === 'cycling') {
          const elevation = +inputElevation.value;
          if (
            !validInputs(distance, duration, elevation) ||
            !allPositive(distance, duration)
          )
            return alert('Inputs have to be positive numbers!');
          newWorkout = new Cycling([lat, lng], distance, duration, elevation);
        }

        const coordinates = workout.coords;

        this._renderWorkoutAtIndex(newWorkout, workoutIndex);
        this._renderWorkoutMarkerAtCoordinate(newWorkout, coordinates);

        this.#workouts.splice(workoutIndex, 0, newWorkout);
      }
    }

    // Hide the form
    this._hideForm();

    // Update local storage
    this._setLocalStorage();
  }

  _renderWorkoutMarkerAtCoordinate(workout, coordinates) {
    workout.coords = coordinates;
    workout.marker = L.marker(coordinates)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();
  }

  _renderWorkoutMarker(workout) {
    workout.marker = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();
  }

  _renderWorkout(workout) {
    let html = `
    <li class="workout workout--${workout.type}" data-id="${workout.id}">
          <h2 class="workout__title">${workout.description}</h2>
          <div class="workout__details">
            <span class="workout__icon">${
              workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
            }</span>
            <span class="workout__value">${workout.distance}</span>
            <span class="workout__unit">km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⏱</span>
            <span class="workout__value">${workout.duration}</span>
            <span class="workout__unit">min</span>
          </div>
          <button class="form__btn--edit" data-id="${workout.id}">Edit</button>
          <button class="form__btn--delete" data-id="${
            workout.id
          }">Delete</button>
          `;

    if (workout.type === 'running')
      html += `
    <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.pace.toFixed(1)}</span>
            <span class="workout__unit">min/km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">🦶🏼</span>
            <span class="workout__value">${workout.cadence}</span>
            <span class="workout__unit">spm</span>
          </div>
        </li>
        `;

    if (workout.type === 'cycling')
      html += `
      <div class="workout__details">
        <span class="workout__icon">⚡️</span>
        <span class="workout__value">${workout.speed.toFixed(1)}</span>
        <span class="workout__unit">km/h</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">⛰</span>
        <span class="workout__value">${workout.elevationGain}</span>
        <span class="workout__unit">m</span>
    </div>
  </li>
  `;

    containerWorkouts.insertAdjacentHTML('afterbegin', html);

    const editButton = document.querySelector(
      `[data-id="${workout.id}"].form__btn--edit`
    );
    const deleteButton = document.querySelector(
      `[data-id="${workout.id}"].form__btn--delete`
    );

    if (editButton) {
      editButton.addEventListener('click', this._editWorkout.bind(this));
    }

    if (deleteButton) {
      deleteButton.addEventListener('click', this._deleteWorkout.bind(this));
    }
  }

  _renderWorkoutAtIndex(workout, index) {
    let html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <h2 class="workout__title">${workout.description}</h2>
        <div class="workout__details">
          <span class="workout__icon">${
            workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
          }</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
        <button class="form__btn--edit" data-id="${workout.id}">Edit</button>
        <button class="form__btn--delete" data-id="${
          workout.id
        }">Delete</button>
    `;

    if (workout.type === 'running') {
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.pace.toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>
      `;
    }

    if (workout.type === 'cycling') {
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.speed.toFixed(1)}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value">${workout.elevationGain}</span>
          <span class="workout__unit">m</span>
        </div>
      `;
    }

    html += `</li>`;

    console.log('at index' + index);

    // Insert the workout HTML at the given index
    const workoutElements = containerWorkouts.querySelectorAll('.workout');
    if (index === 0) {
      // If the index is greater than the number of workout elements, insert at the end
      containerWorkouts.insertAdjacentHTML('beforeend', html);
      console.log('yes');
    } else {
      // Otherwise, insert at the specified index
      workoutElements[index].insertAdjacentHTML('beforebegin', html);
    }

    const editButton = document.querySelector(
      `[data-id="${workout.id}"].form__btn--edit`
    );
    const deleteButton = document.querySelector(
      `[data-id="${workout.id}"].form__btn--delete`
    );

    if (editButton) {
      editButton.addEventListener('click', this._editWorkout.bind(this));
    }

    if (deleteButton) {
      deleteButton.addEventListener('click', this._deleteWorkout.bind(this));
    }
  }

  _editWorkout(e) {
    editing = true;
    console.log('edit');
    const workoutElement = e.target.closest('.workout');
    const workoutId = workoutElement.dataset.id;
    const workout = this.#workouts.find(work => work.id === workoutId);

    console.log(workout.type);
    // Set the form values with workout data
    inputType.value = workout.type;
    inputDistance.value = workout.distance;
    inputDuration.value = workout.duration;

    // Show the appropriate fields based on workout type
    if (workout.type === 'running') {
      inputCadence.closest('.form__row').classList.remove('form__row--hidden');
      inputElevation.closest('.form__row').classList.add('form__row--hidden');
      inputCadence.value = workout.cadence || '';
    }

    if (workout.type === 'cycling') {
      inputCadence.closest('.form__row').classList.add('form__row--hidden');
      inputElevation
        .closest('.form__row')
        .classList.remove('form__row--hidden');
      inputElevation.value = workout.elevationGain || '';
    }

    // Show the form
    form.classList.remove('hidden');
    form.style.display = 'grid';
    form.dataset.id = workoutId;
  }

  _moveToPopup(workoutId) {
    const workout = this.#workouts.find(work => work.id === workoutId);

    if (workout) {
      this.#map.setView(workout.coords, this.#mapZoomLevel, {
        animate: true,
        duration: 1,
      });
    }
  }

  _setLocalStorage() {
    const workoutsWithoutMap = this.#workouts.map(workout => {
      const { marker, ...workoutWithoutMarker } = workout;
      return workoutWithoutMarker;
    });

    localStorage.setItem('workouts', JSON.stringify(workoutsWithoutMap));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    data.forEach(item => {
      if (item.type === 'running') {
        this.#workouts.push(
          new Running(item.coords, item.distance, item.duration, item.cadence)
        );
      } else {
        this.#workouts.push(
          new Cycling(
            item.coords,
            item.distance,
            item.duration,
            item.elevationGain
          )
        );
      }
    });

    this.#workouts.forEach(work => {
      this._renderWorkout(work);
    });
  }

  // reset() {
  //   // Remove all workouts from the array
  //   this.#workouts = [];

  //   // Remove all workout elements from the DOM
  //   const workoutElements = document.querySelectorAll('.workout');
  //   workoutElements.forEach(element => element.remove());

  //   // Clear local storage
  //   this._setLocalStorage();
  // }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }

  _deleteWorkout(e) {
    const workoutId = e.target.dataset.id;
    const workoutIndex = this.#workouts.findIndex(
      work => work.id === workoutId
    );

    if (workoutIndex === -1) return;

    // Remove the workout from the array
    const deletedWorkout = this.#workouts.splice(workoutIndex, 1)[0];

    // Remove the workout element from the DOM
    const workoutEl = e.target.closest('.workout');
    workoutEl.remove();

    // Remove the marker from the map
    this.#map.removeLayer(deletedWorkout.marker);

    // Update local storage
    this._setLocalStorage();
  }
}

const app = new App();
