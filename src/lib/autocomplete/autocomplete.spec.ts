import {async, ComponentFixture, fakeAsync, TestBed, tick} from '@angular/core/testing';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  QueryList,
  ViewChild,
  ViewChildren,
} from '@angular/core';
import {By} from '@angular/platform-browser';
import {NoopAnimationsModule} from '@angular/platform-browser/animations';
import {FormControl, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {ScrollDispatcher} from '@angular/cdk/scrolling';
import {OverlayContainer} from '@angular/cdk/overlay';
import {Direction, Directionality} from '@angular/cdk/bidi';
import {map, RxChain, startWith} from '@angular/cdk/rxjs';
import {createKeyboardEvent, dispatchFakeEvent, typeInElement} from '@angular/cdk/testing';
import {
  getMdAutocompleteMissingPanelError,
  MdAutocomplete,
  MdAutocompleteModule,
  MdAutocompleteTrigger,
} from './index';
import {MdInputModule} from '../input/index';
import {Subscription} from 'rxjs/Subscription';
import {DOWN_ARROW, ENTER, ESCAPE, SPACE, UP_ARROW} from '../core/keyboard/keycodes';
import {MdOption} from '../core/option/option';
import {MdFormField, MdFormFieldModule} from '../form-field/index';
import {Observable} from 'rxjs/Observable';
import {Subject} from 'rxjs/Subject';


describe('MdAutocomplete', () => {
  let overlayContainerElement: HTMLElement;
  let dir: Direction;
  let scrolledSubject = new Subject();

  beforeEach(async(() => {
    dir = 'ltr';
    TestBed.configureTestingModule({
      imports: [
        MdAutocompleteModule,
        MdFormFieldModule,
        MdInputModule,
        FormsModule,
        ReactiveFormsModule,
        NoopAnimationsModule
      ],
      declarations: [
        SimpleAutocomplete,
        AutocompleteWithoutForms,
        NgIfAutocomplete,
        AutocompleteWithNgModel,
        AutocompleteWithNumbers,
        AutocompleteWithOnPushDelay,
        AutocompleteWithNativeInput,
        AutocompleteWithoutPanel,
        AutocompleteWithFormsAndNonfloatingPlaceholder,
        AutocompleteWithGroups
      ],
      providers: [
        {provide: OverlayContainer, useFactory: () => {
          overlayContainerElement = document.createElement('div');
          overlayContainerElement.classList.add('cdk-overlay-container');

          document.body.appendChild(overlayContainerElement);

          // remove body padding to keep consistent cross-browser
          document.body.style.padding = '0';
          document.body.style.margin = '0';

          return {getContainerElement: () => overlayContainerElement};
        }},
        {provide: Directionality, useFactory: () => ({value: dir})},
        {provide: ScrollDispatcher, useFactory: () => {
          return {scrolled: (_delay: number, callback: () => any) => {
            return scrolledSubject.asObservable().subscribe(callback);
          }};
        }}
      ]
    });

    TestBed.compileComponents();
  }));

  afterEach(() => {
    document.body.removeChild(overlayContainerElement);
  });

  describe('panel toggling', () => {
    let fixture: ComponentFixture<SimpleAutocomplete>;
    let input: HTMLInputElement;

    beforeEach(() => {
      fixture = TestBed.createComponent(SimpleAutocomplete);
      fixture.detectChanges();

      input = fixture.debugElement.query(By.css('input')).nativeElement;
    });

    it('should open the panel when the input is focused', async(() => {
      expect(fixture.componentInstance.trigger.panelOpen)
          .toBe(false, `Expected panel state to start out closed.`);

      dispatchFakeEvent(input, 'focusin');
      fixture.whenStable().then(() => {
        fixture.detectChanges();

        expect(fixture.componentInstance.trigger.panelOpen)
            .toBe(true, `Expected panel state to read open when input is focused.`);
        expect(overlayContainerElement.textContent)
            .toContain('Alabama', `Expected panel to display when input is focused.`);
        expect(overlayContainerElement.textContent)
            .toContain('California', `Expected panel to display when input is focused.`);
      });
    }));

    it('should open the panel programmatically', async(() => {
      expect(fixture.componentInstance.trigger.panelOpen)
          .toBe(false, `Expected panel state to start out closed.`);

      fixture.componentInstance.trigger.openPanel();
      fixture.whenStable().then(() => {
        fixture.detectChanges();

        expect(fixture.componentInstance.trigger.panelOpen)
            .toBe(true, `Expected panel state to read open when opened programmatically.`);
        expect(overlayContainerElement.textContent)
            .toContain('Alabama', `Expected panel to display when opened programmatically.`);
        expect(overlayContainerElement.textContent)
            .toContain('California', `Expected panel to display when opened programmatically.`);
      });
    }));

    it('should show the panel when the first open is after the initial zone stabilization',
      async(() => {
        // Note that we're running outside the Angular zone, in order to be able
        // to test properly without the subscription from `_subscribeToClosingActions`
        // giving us a false positive.
        fixture.ngZone!.runOutsideAngular(() => {
          fixture.componentInstance.trigger.openPanel();

          Promise.resolve().then(() => {
            expect(fixture.componentInstance.panel.showPanel)
                .toBe(true, `Expected panel to be visible.`);
          });
        });
      }));

    it('should close the panel when the user clicks away', async(() => {
      dispatchFakeEvent(input, 'focusin');
      fixture.detectChanges();

      fixture.whenStable().then(() => {
        dispatchFakeEvent(document, 'click');

        expect(fixture.componentInstance.trigger.panelOpen)
            .toBe(false, `Expected clicking outside the panel to set its state to closed.`);
        expect(overlayContainerElement.textContent)
            .toEqual('', `Expected clicking outside the panel to close the panel.`);
      });
    }));

    it('should close the panel when the user taps away on a touch device', async(() => {
      dispatchFakeEvent(input, 'focus');
      fixture.detectChanges();

      fixture.whenStable().then(() => {
        dispatchFakeEvent(document, 'touchend');

        expect(fixture.componentInstance.trigger.panelOpen)
            .toBe(false, `Expected tapping outside the panel to set its state to closed.`);
        expect(overlayContainerElement.textContent)
            .toEqual('', `Expected tapping outside the panel to close the panel.`);
      });
    }));

    it('should close the panel when an option is clicked', async(() => {
      dispatchFakeEvent(input, 'focusin');
      fixture.detectChanges();

      fixture.whenStable().then(() => {
        const option = overlayContainerElement.querySelector('md-option') as HTMLElement;
        option.click();
        fixture.detectChanges();

        expect(fixture.componentInstance.trigger.panelOpen)
            .toBe(false, `Expected clicking an option to set the panel state to closed.`);
        expect(overlayContainerElement.textContent)
            .toEqual('', `Expected clicking an option to close the panel.`);
      });
    }));

    it('should close the panel when a newly created option is clicked', async(() => {
      dispatchFakeEvent(input, 'focusin');
      fixture.detectChanges();

      fixture.whenStable().then(() => {
        // Filter down the option list to a subset of original options ('Alabama', 'California')
        typeInElement('al', input);
        fixture.detectChanges();

        let options =
            overlayContainerElement.querySelectorAll('md-option') as NodeListOf<HTMLElement>;
        options[0].click();

        // Changing value from 'Alabama' to 'al' to re-populate the option list,
        // ensuring that 'California' is created new.
        typeInElement('al', input);
        fixture.detectChanges();

        fixture.whenStable().then(() => {
          options =
              overlayContainerElement.querySelectorAll('md-option') as NodeListOf<HTMLElement>;
          options[1].click();
          fixture.detectChanges();

          expect(fixture.componentInstance.trigger.panelOpen)
              .toBe(false, `Expected clicking a new option to set the panel state to closed.`);
          expect(overlayContainerElement.textContent)
              .toEqual('', `Expected clicking a new option to close the panel.`);
        });
      });
    }));

    it('should close the panel programmatically', async(() => {
      fixture.componentInstance.trigger.openPanel();
      fixture.detectChanges();

      fixture.whenStable().then(() => {
        fixture.componentInstance.trigger.closePanel();
        fixture.detectChanges();

        fixture.whenStable().then(() => {
          expect(fixture.componentInstance.trigger.panelOpen)
              .toBe(false, `Expected closing programmatically to set the panel state to closed.`);
          expect(overlayContainerElement.textContent)
              .toEqual('', `Expected closing programmatically to close the panel.`);
        });
      });
    }));

    it('should not throw when attempting to close the panel of a destroyed autocomplete', () => {
      const trigger = fixture.componentInstance.trigger;

      trigger.openPanel();
      fixture.detectChanges();
      fixture.destroy();

      expect(() => trigger.closePanel()).not.toThrow();
    });

    it('should hide the panel when the options list is empty', async(() => {
      dispatchFakeEvent(input, 'focusin');

      fixture.whenStable().then(() => {
        fixture.detectChanges();

        const panel =
            overlayContainerElement.querySelector('.mat-autocomplete-panel') as HTMLElement;
        expect(panel.classList)
            .toContain('mat-autocomplete-visible', `Expected panel to start out visible.`);

        // Filter down the option list such that no options match the value
        typeInElement('af', input);
        fixture.detectChanges();

        fixture.whenStable().then(() => {
          fixture.detectChanges();

          expect(panel.classList)
              .toContain('mat-autocomplete-hidden', `Expected panel to hide itself when empty.`);
        });
      });
    }));

    it('should keep the label floating until the panel closes', async(() => {
      fixture.componentInstance.trigger.openPanel();
      expect(fixture.componentInstance.formField.floatPlaceholder)
          .toEqual('always', 'Expected placeholder to float as soon as panel opens.');

      fixture.whenStable().then(() => {
        fixture.detectChanges();

        const options =
            overlayContainerElement.querySelectorAll('md-option') as NodeListOf<HTMLElement>;
        options[1].click();
        fixture.detectChanges();

        expect(fixture.componentInstance.formField.floatPlaceholder)
            .toEqual('auto', 'Expected placeholder to return to auto state after panel closes.');
      });
    }));

    it('should not open the panel when the `input` event is invoked on a non-focused input', () => {
      expect(fixture.componentInstance.trigger.panelOpen)
          .toBe(false, `Expected panel state to start out closed.`);

      input.value = 'Alabama';
      dispatchFakeEvent(input, 'input');
      fixture.detectChanges();

      expect(fixture.componentInstance.trigger.panelOpen)
          .toBe(false, `Expected panel state to stay closed.`);
    });

   it('should not mess with placeholder placement if set to never', async(() => {
      fixture.componentInstance.placeholder = 'never';
      fixture.detectChanges();

      fixture.componentInstance.trigger.openPanel();
      expect(fixture.componentInstance.formField.floatPlaceholder)
          .toEqual('never', 'Expected placeholder to stay static.');

      fixture.whenStable().then(() => {
        fixture.detectChanges();

        const options =
            overlayContainerElement.querySelectorAll('md-option') as NodeListOf<HTMLElement>;
        options[1].click();
        fixture.detectChanges();

        expect(fixture.componentInstance.formField.floatPlaceholder)
            .toEqual('never', 'Expected placeholder to stay in static state after close.');
      });
    }));

    it('should not mess with placeholder placement if set to always', async(() => {
      fixture.componentInstance.placeholder = 'always';
      fixture.detectChanges();

      fixture.componentInstance.trigger.openPanel();
      expect(fixture.componentInstance.formField.floatPlaceholder)
          .toEqual('always', 'Expected placeholder to stay elevated on open.');

      fixture.whenStable().then(() => {
        fixture.detectChanges();

        const options =
            overlayContainerElement.querySelectorAll('md-option') as NodeListOf<HTMLElement>;
        options[1].click();
        fixture.detectChanges();

        expect(fixture.componentInstance.formField.floatPlaceholder)
            .toEqual('always', 'Expected placeholder to stay elevated after close.');
      });
    }));

    it('should toggle the visibility when typing and closing the panel', fakeAsync(() => {
      fixture.componentInstance.trigger.openPanel();
      tick();
      fixture.detectChanges();

      expect(overlayContainerElement.querySelector('.mat-autocomplete-panel')!.classList)
          .toContain('mat-autocomplete-visible', 'Expected panel to be visible.');

      typeInElement('x', input);
      fixture.detectChanges();
      tick();
      fixture.detectChanges();

      expect(overlayContainerElement.querySelector('.mat-autocomplete-panel')!.classList)
          .toContain('mat-autocomplete-hidden', 'Expected panel to be hidden.');

      fixture.componentInstance.trigger.closePanel();
      fixture.detectChanges();

      fixture.componentInstance.trigger.openPanel();
      fixture.detectChanges();

      typeInElement('al', input);
      fixture.detectChanges();
      tick();
      fixture.detectChanges();

      expect(overlayContainerElement.querySelector('.mat-autocomplete-panel')!.classList)
          .toContain('mat-autocomplete-visible', 'Expected panel to be visible.');
    }));

    it('should animate the placeholder when the input is focused', () => {
      const inputContainer = fixture.componentInstance.formField;

      spyOn(inputContainer, '_animateAndLockPlaceholder');
      expect(inputContainer._animateAndLockPlaceholder).not.toHaveBeenCalled();

      dispatchFakeEvent(fixture.debugElement.query(By.css('input')).nativeElement, 'focusin');
      expect(inputContainer._animateAndLockPlaceholder).toHaveBeenCalled();
    });

  });

  it('should have the correct text direction in RTL', () => {
    dir = 'rtl';

    const rtlFixture = TestBed.createComponent(SimpleAutocomplete);
    rtlFixture.detectChanges();

    rtlFixture.componentInstance.trigger.openPanel();
    rtlFixture.detectChanges();

    const overlayPane = overlayContainerElement.querySelector('.cdk-overlay-pane')!;
    expect(overlayPane.getAttribute('dir')).toEqual('rtl');

  });

  describe('forms integration', () => {
    let fixture: ComponentFixture<SimpleAutocomplete>;
    let input: HTMLInputElement;

    beforeEach(() => {
      fixture = TestBed.createComponent(SimpleAutocomplete);
      fixture.detectChanges();

      input = fixture.debugElement.query(By.css('input')).nativeElement;
    });

    it('should update control value as user types with input value', () => {
      fixture.componentInstance.trigger.openPanel();
      fixture.detectChanges();

      typeInElement('a', input);
      fixture.detectChanges();

      expect(fixture.componentInstance.stateCtrl.value)
          .toEqual('a', 'Expected control value to be updated as user types.');

      typeInElement('al', input);
      fixture.detectChanges();

      expect(fixture.componentInstance.stateCtrl.value)
          .toEqual('al', 'Expected control value to be updated as user types.');
    });

    it('should update control value when option is selected with option value', async(() => {
      fixture.componentInstance.trigger.openPanel();
      fixture.detectChanges();

      fixture.whenStable().then(() => {
        const options =
            overlayContainerElement.querySelectorAll('md-option') as NodeListOf<HTMLElement>;
        options[1].click();
        fixture.detectChanges();

        expect(fixture.componentInstance.stateCtrl.value)
            .toEqual({code: 'CA', name: 'California'},
                'Expected control value to equal the selected option value.');
      });
    }));

    it('should update control back to string if user types after option is selected', async(() => {
      fixture.componentInstance.trigger.openPanel();
      fixture.detectChanges();

      fixture.whenStable().then(() => {
        const options =
            overlayContainerElement.querySelectorAll('md-option') as NodeListOf<HTMLElement>;
        options[1].click();
        fixture.detectChanges();

        typeInElement('Californi', input);
        fixture.detectChanges();

        expect(fixture.componentInstance.stateCtrl.value)
            .toEqual('Californi', 'Expected control value to revert back to string.');
      });
    }));

    it('should fill the text field with display value when an option is selected', async(() => {
      fixture.componentInstance.trigger.openPanel();
      fixture.detectChanges();

      fixture.whenStable().then(() => {
        const options =
            overlayContainerElement.querySelectorAll('md-option') as NodeListOf<HTMLElement>;
        options[1].click();
        fixture.detectChanges();

        expect(input.value)
            .toContain('California', `Expected text field to fill with selected value.`);
      });
    }));

    it('should fill the text field with value if displayWith is not set', async(() => {
      fixture.componentInstance.trigger.openPanel();
      fixture.detectChanges();

      fixture.whenStable().then(() => {
        fixture.componentInstance.panel.displayWith = null;
        fixture.componentInstance.options.toArray()[1].value = 'test value';
        fixture.detectChanges();

        const options =
            overlayContainerElement.querySelectorAll('md-option') as NodeListOf<HTMLElement>;
        options[1].click();

        fixture.detectChanges();
        expect(input.value)
            .toContain('test value', `Expected input to fall back to selected option's value.`);
        });
    }));

    it('should fill the text field correctly if value is set to obj programmatically', async(() => {
      fixture.whenStable().then(() => {
        fixture.componentInstance.stateCtrl.setValue({code: 'AL', name: 'Alabama'});
        fixture.detectChanges();

        fixture.whenStable().then(() => {
          fixture.detectChanges();
          expect(input.value)
              .toContain('Alabama', `Expected input to fill with matching option's viewValue.`);
        });
      });
    }));

    it('should clear the text field if value is reset programmatically', async(() => {
      typeInElement('Alabama', input);
      fixture.detectChanges();

      fixture.whenStable().then(() => {
        fixture.componentInstance.stateCtrl.reset();

        fixture.whenStable().then(() => {
          fixture.detectChanges();
          expect(input.value).toEqual('', `Expected input value to be empty after reset.`);
        });
      });
    }));

    it('should disable input in view when disabled programmatically', () => {
      const inputUnderline =
          fixture.debugElement.query(By.css('.mat-form-field-underline')).nativeElement;

      expect(input.disabled)
          .toBe(false, `Expected input to start out enabled in view.`);
      expect(inputUnderline.classList.contains('mat-disabled'))
          .toBe(false, `Expected input underline to start out with normal styles.`);

      fixture.componentInstance.stateCtrl.disable();
      fixture.detectChanges();

      expect(input.disabled)
          .toBe(true, `Expected input to be disabled in view when disabled programmatically.`);
      expect(inputUnderline.classList.contains('mat-disabled'))
          .toBe(true, `Expected input underline to display disabled styles.`);
    });


    it('should mark the autocomplete control as dirty as user types', () => {
      expect(fixture.componentInstance.stateCtrl.dirty)
          .toBe(false, `Expected control to start out pristine.`);

      typeInElement('a', input);
      fixture.detectChanges();

      expect(fixture.componentInstance.stateCtrl.dirty)
          .toBe(true, `Expected control to become dirty when the user types into the input.`);
    });

    it('should mark the autocomplete control as dirty when an option is selected', async(() => {
      expect(fixture.componentInstance.stateCtrl.dirty)
          .toBe(false, `Expected control to start out pristine.`);

      fixture.componentInstance.trigger.openPanel();
      fixture.detectChanges();

      fixture.whenStable().then(() => {
        const options =
            overlayContainerElement.querySelectorAll('md-option') as NodeListOf<HTMLElement>;
        options[1].click();
        fixture.detectChanges();

        expect(fixture.componentInstance.stateCtrl.dirty)
            .toBe(true, `Expected control to become dirty when an option was selected.`);
      });
    }));

    it('should not mark the control dirty when the value is set programmatically', () => {
      expect(fixture.componentInstance.stateCtrl.dirty)
          .toBe(false, `Expected control to start out pristine.`);

      fixture.componentInstance.stateCtrl.setValue('AL');
      fixture.detectChanges();

      expect(fixture.componentInstance.stateCtrl.dirty)
          .toBe(false, `Expected control to stay pristine if value is set programmatically.`);
    });

    it('should mark the autocomplete control as touched on blur', () => {
      fixture.componentInstance.trigger.openPanel();
      fixture.detectChanges();
      expect(fixture.componentInstance.stateCtrl.touched)
          .toBe(false, `Expected control to start out untouched.`);

      dispatchFakeEvent(input, 'blur');
      fixture.detectChanges();

      expect(fixture.componentInstance.stateCtrl.touched)
          .toBe(true, `Expected control to become touched on blur.`);
    });

  });

  describe('keyboard events', () => {
    let fixture: ComponentFixture<SimpleAutocomplete>;
    let input: HTMLInputElement;
    let DOWN_ARROW_EVENT: KeyboardEvent;
    let UP_ARROW_EVENT: KeyboardEvent;
    let ENTER_EVENT: KeyboardEvent;

    beforeEach(() => {
      fixture = TestBed.createComponent(SimpleAutocomplete);
      fixture.detectChanges();

      input = fixture.debugElement.query(By.css('input')).nativeElement;
      DOWN_ARROW_EVENT = createKeyboardEvent('keydown', DOWN_ARROW);
      UP_ARROW_EVENT = createKeyboardEvent('keydown', UP_ARROW);
      ENTER_EVENT = createKeyboardEvent('keydown', ENTER);

      fixture.componentInstance.trigger.openPanel();
      fixture.detectChanges();
    });

    it('should not focus the option when DOWN key is pressed', async(() => {
      fixture.whenStable().then(() => {
        spyOn(fixture.componentInstance.options.first, 'focus');

        fixture.componentInstance.trigger._handleKeydown(DOWN_ARROW_EVENT);
        expect(fixture.componentInstance.options.first.focus).not.toHaveBeenCalled();
      });
    }));

    it('should not close the panel when DOWN key is pressed', async(() => {
      fixture.whenStable().then(() => {
        fixture.componentInstance.trigger._handleKeydown(DOWN_ARROW_EVENT);

      expect(fixture.componentInstance.trigger.panelOpen)
          .toBe(true, `Expected panel state to stay open when DOWN key is pressed.`);
      expect(overlayContainerElement.textContent)
          .toContain('Alabama', `Expected panel to keep displaying when DOWN key is pressed.`);
      expect(overlayContainerElement.textContent)
          .toContain('California', `Expected panel to keep displaying when DOWN key is pressed.`);
      });
    }));

    it('should set the active item to the first option when DOWN key is pressed', fakeAsync(() => {
      tick();
      const optionEls =
          overlayContainerElement.querySelectorAll('md-option') as NodeListOf<HTMLElement>;

      fixture.componentInstance.trigger._handleKeydown(DOWN_ARROW_EVENT);
      tick();
      fixture.detectChanges();

      expect(fixture.componentInstance.trigger.panelOpen)
          .toBe(true, 'Expected first down press to open the pane.');

      fixture.componentInstance.trigger._handleKeydown(DOWN_ARROW_EVENT);
      tick();
      fixture.detectChanges();

      expect(fixture.componentInstance.trigger.activeOption)
          .toBe(fixture.componentInstance.options.first, 'Expected first option to be active.');
      expect(optionEls[0].classList).toContain('mat-active');
      expect(optionEls[1].classList).not.toContain('mat-active');

      fixture.componentInstance.trigger._handleKeydown(DOWN_ARROW_EVENT);
      tick();
      fixture.detectChanges();

      expect(fixture.componentInstance.trigger.activeOption)
          .toBe(fixture.componentInstance.options.toArray()[1],
              'Expected second option to be active.');
      expect(optionEls[0].classList).not.toContain('mat-active');
      expect(optionEls[1].classList).toContain('mat-active');
    }));

    it('should set the active item to the last option when UP key is pressed', fakeAsync(() => {
      tick();
      const optionEls =
          overlayContainerElement.querySelectorAll('md-option') as NodeListOf<HTMLElement>;

      fixture.componentInstance.trigger._handleKeydown(UP_ARROW_EVENT);
      tick();
      fixture.detectChanges();

      expect(fixture.componentInstance.trigger.panelOpen)
          .toBe(true, 'Expected first up press to open the pane.');

      fixture.componentInstance.trigger._handleKeydown(UP_ARROW_EVENT);
      tick();
      fixture.detectChanges();

      expect(fixture.componentInstance.trigger.activeOption)
          .toBe(fixture.componentInstance.options.last, 'Expected last option to be active.');
      expect(optionEls[10].classList).toContain('mat-active');
      expect(optionEls[0].classList).not.toContain('mat-active');

      fixture.componentInstance.trigger._handleKeydown(DOWN_ARROW_EVENT);
      tick();
      fixture.detectChanges();

      expect(fixture.componentInstance.trigger.activeOption)
          .toBe(fixture.componentInstance.options.first,
              'Expected first option to be active.');
      expect(optionEls[0].classList).toContain('mat-active');
    }));

    it('should set the active item properly after filtering', fakeAsync(() => {
      fixture.componentInstance.trigger._handleKeydown(DOWN_ARROW_EVENT);
      tick();
      fixture.detectChanges();

      typeInElement('o', input);
      fixture.detectChanges();

      fixture.componentInstance.trigger._handleKeydown(DOWN_ARROW_EVENT);
      tick();
      fixture.detectChanges();

      const optionEls =
          overlayContainerElement.querySelectorAll('md-option') as NodeListOf<HTMLElement>;

      expect(fixture.componentInstance.trigger.activeOption)
          .toBe(fixture.componentInstance.options.first,
              'Expected first option to be active.');
      expect(optionEls[0].classList).toContain('mat-active');
      expect(optionEls[1].classList).not.toContain('mat-active');
    }));

    it('should fill the text field when an option is selected with ENTER', async(() => {
      fixture.whenStable().then(() => {
        fixture.componentInstance.trigger._handleKeydown(DOWN_ARROW_EVENT);

        fixture.whenStable().then(() => {
          fixture.detectChanges();

          fixture.componentInstance.trigger._handleKeydown(ENTER_EVENT);
          fixture.detectChanges();
          expect(input.value)
              .toContain('Alabama', `Expected text field to fill with selected value on ENTER.`);
        });
      });
    }));

    it('should prevent the default enter key action', async(() => {
      fixture.whenStable().then(() => {
        fixture.componentInstance.trigger._handleKeydown(DOWN_ARROW_EVENT);

        fixture.whenStable().then(() => {
          fixture.componentInstance.trigger._handleKeydown(ENTER_EVENT);

          expect(ENTER_EVENT.defaultPrevented)
              .toBe(true, 'Expected the default action to have been prevented.');
        });
      });
    }));

    it('should not prevent the default enter action for a closed panel after a user interaction',
      fakeAsync(() => {
        tick();
        fixture.componentInstance.trigger._handleKeydown(UP_ARROW_EVENT);
        tick();
        fixture.detectChanges();

        fixture.componentInstance.trigger.closePanel();
        fixture.detectChanges();
        fixture.componentInstance.trigger._handleKeydown(ENTER_EVENT);

        expect(ENTER_EVENT.defaultPrevented).toBe(false, 'Default action should not be prevented.');
      }));

    it('should fill the text field, not select an option, when SPACE is entered', async(() => {
      fixture.whenStable().then(() => {
        typeInElement('New', input);
        fixture.detectChanges();

        const SPACE_EVENT = createKeyboardEvent('keydown', SPACE);
        fixture.componentInstance.trigger._handleKeydown(DOWN_ARROW_EVENT);

        fixture.whenStable().then(() => {
          fixture.detectChanges();

          fixture.componentInstance.trigger._handleKeydown(SPACE_EVENT);
          fixture.detectChanges();

          expect(input.value)
              .not.toContain('New York', `Expected option not to be selected on SPACE.`);
        });
      });
    }));

    it('should mark the control dirty when selecting an option from the keyboard', async(() => {
      fixture.whenStable().then(() => {
        expect(fixture.componentInstance.stateCtrl.dirty)
            .toBe(false, `Expected control to start out pristine.`);

        fixture.componentInstance.trigger._handleKeydown(DOWN_ARROW_EVENT);
        fixture.whenStable().then(() => {
          fixture.componentInstance.trigger._handleKeydown(ENTER_EVENT);
          fixture.detectChanges();

          expect(fixture.componentInstance.stateCtrl.dirty)
              .toBe(true, `Expected control to become dirty when option was selected by ENTER.`);
        });
      });
    }));

    it('should open the panel again when typing after making a selection', async(() => {
      fixture.whenStable().then(() => {
        fixture.componentInstance.trigger._handleKeydown(DOWN_ARROW_EVENT);
        fixture.whenStable().then(() => {
          fixture.componentInstance.trigger._handleKeydown(ENTER_EVENT);
          fixture.detectChanges();

          expect(fixture.componentInstance.trigger.panelOpen)
              .toBe(false, `Expected panel state to read closed after ENTER key.`);
          expect(overlayContainerElement.textContent)
              .toEqual('', `Expected panel to close after ENTER key.`);

          typeInElement('Alabama', input);
          fixture.detectChanges();

          expect(fixture.componentInstance.trigger.panelOpen)
              .toBe(true, `Expected panel state to read open when typing in input.`);
          expect(overlayContainerElement.textContent)
              .toContain('Alabama', `Expected panel to display when typing in input.`);
          });
        });
    }));

    it('should scroll to active options below the fold', fakeAsync(() => {
      tick();
      const scrollContainer =
          document.querySelector('.cdk-overlay-pane .mat-autocomplete-panel')!;

      fixture.componentInstance.trigger._handleKeydown(DOWN_ARROW_EVENT);
      tick();
      fixture.detectChanges();
      expect(scrollContainer.scrollTop).toEqual(0, `Expected panel not to scroll.`);

      // These down arrows will set the 6th option active, below the fold.
      [1, 2, 3, 4, 5, 6].forEach(() => {
        fixture.componentInstance.trigger._handleKeydown(DOWN_ARROW_EVENT);
        tick();
      });

      // Expect option bottom minus the panel height (288 - 256 = 32)
      expect(scrollContainer.scrollTop)
          .toEqual(32, `Expected panel to reveal the sixth option.`);
    }));

    it('should scroll to active options on UP arrow', async(() => {
      fixture.whenStable().then(() => {
        const scrollContainer =
            document.querySelector('.cdk-overlay-pane .mat-autocomplete-panel')!;

        fixture.componentInstance.trigger._handleKeydown(UP_ARROW_EVENT);
        fixture.detectChanges();

        fixture.whenStable().then(() => {
          // Expect option bottom minus the panel height (528 - 256 = 272)
          expect(scrollContainer.scrollTop).toEqual(272, `Expected panel to reveal last option.`);
        });
      });
    }));

    it('should not scroll to active options that are fully in the panel', fakeAsync(() => {
      tick();
      const scrollContainer =
          document.querySelector('.cdk-overlay-pane .mat-autocomplete-panel')!;

      fixture.componentInstance.trigger._handleKeydown(DOWN_ARROW_EVENT);
      tick();
      fixture.detectChanges();
      expect(scrollContainer.scrollTop).toEqual(0, `Expected panel not to scroll.`);

      // These down arrows will set the 6th option active, below the fold.
      [1, 2, 3, 4, 5, 6].forEach(() => {
        fixture.componentInstance.trigger._handleKeydown(DOWN_ARROW_EVENT);
        tick();
      });

      // Expect option bottom minus the panel height (288 - 256 = 32)
      expect(scrollContainer.scrollTop)
          .toEqual(32, `Expected panel to reveal the sixth option.`);

      // These up arrows will set the 2nd option active
      [4, 3, 2, 1].forEach(() => {
        fixture.componentInstance.trigger._handleKeydown(UP_ARROW_EVENT);
        tick();
      });

      // Expect no scrolling to have occurred. Still showing bottom of 6th option.
      expect(scrollContainer.scrollTop)
          .toEqual(32, `Expected panel not to scroll up since sixth option still fully visible.`);
    }));

    it('should scroll to active options that are above the panel', fakeAsync(() => {
      tick();
      const scrollContainer =
          document.querySelector('.cdk-overlay-pane .mat-autocomplete-panel')!;

      fixture.componentInstance.trigger._handleKeydown(DOWN_ARROW_EVENT);
      tick();
      fixture.detectChanges();
      expect(scrollContainer.scrollTop).toEqual(0, `Expected panel not to scroll.`);

      // These down arrows will set the 7th option active, below the fold.
      [1, 2, 3, 4, 5, 6, 7].forEach(() => {
        fixture.componentInstance.trigger._handleKeydown(DOWN_ARROW_EVENT);
        tick();
      });

      // These up arrows will set the 2nd option as active
      [5, 4, 3, 2, 1].forEach(() => {
        fixture.componentInstance.trigger._handleKeydown(UP_ARROW_EVENT);
        tick();
      });

      // Expect to show the top of the 2nd option at the top of the panel
      expect(scrollContainer.scrollTop)
          .toEqual(48, `Expected panel to scroll up when option is above panel.`);
    }));

    it('should close the panel when pressing escape', async(() => {
      const trigger = fixture.componentInstance.trigger;
      const escapeEvent = createKeyboardEvent('keydown', ESCAPE);
      const stopPropagationSpy = spyOn(escapeEvent, 'stopPropagation').and.callThrough();

      input.focus();

      fixture.whenStable().then(() => {
        expect(document.activeElement).toBe(input, 'Expected input to be focused.');
        expect(trigger.panelOpen).toBe(true, 'Expected panel to be open.');

        trigger._handleKeydown(escapeEvent);

        expect(document.activeElement).toBe(input, 'Expected input to continue to be focused.');
        expect(trigger.panelOpen).toBe(false, 'Expected panel to be closed.');
        expect(stopPropagationSpy).toHaveBeenCalled();
      });
    }));

    it('should reset the active option when closing with the escape key', fakeAsync(() => {
      const trigger = fixture.componentInstance.trigger;

      trigger.openPanel();
      fixture.detectChanges();
      tick();

      expect(trigger.panelOpen).toBe(true, 'Expected panel to be open.');
      expect(!!trigger.activeOption).toBe(false, 'Expected no active option.');

      // Press the down arrow a few times.
      [1, 2, 3].forEach(() => {
        trigger._handleKeydown(DOWN_ARROW_EVENT);
        tick();
        fixture.detectChanges();
      });

      // Note that this casts to a boolean, in order to prevent Jasmine
      // from crashing when trying to stringify the option if the test fails.
      expect(!!trigger.activeOption).toBe(true, 'Expected to find an active option.');

      trigger._handleKeydown(createKeyboardEvent('keydown', ESCAPE));
      tick();

      expect(!!trigger.activeOption).toBe(false, 'Expected no active options.');
    }));

    it('should reset the active option when closing by selecting with enter', fakeAsync(() => {
      const trigger = fixture.componentInstance.trigger;

      trigger.openPanel();
      fixture.detectChanges();
      tick();

      expect(trigger.panelOpen).toBe(true, 'Expected panel to be open.');
      expect(!!trigger.activeOption).toBe(false, 'Expected no active option.');

      // Press the down arrow a few times.
      [1, 2, 3].forEach(() => {
        trigger._handleKeydown(DOWN_ARROW_EVENT);
        tick();
        fixture.detectChanges();
      });

      // Note that this casts to a boolean, in order to prevent Jasmine
      // from crashing when trying to stringify the option if the test fails.
      expect(!!trigger.activeOption).toBe(true, 'Expected to find an active option.');

      trigger._handleKeydown(ENTER_EVENT);
      tick();

      expect(!!trigger.activeOption).toBe(false, 'Expected no active options.');
    }));

  });

  describe('option groups', () => {
    let fixture: ComponentFixture<AutocompleteWithGroups>;
    let DOWN_ARROW_EVENT: KeyboardEvent;
    let UP_ARROW_EVENT: KeyboardEvent;
    let container: HTMLElement;

    beforeEach(fakeAsync(() => {
      fixture = TestBed.createComponent(AutocompleteWithGroups);
      fixture.detectChanges();

      DOWN_ARROW_EVENT = createKeyboardEvent('keydown', DOWN_ARROW);
      UP_ARROW_EVENT = createKeyboardEvent('keydown', UP_ARROW);

      fixture.componentInstance.trigger.openPanel();
      fixture.detectChanges();
      tick();
      fixture.detectChanges();
      container = document.querySelector('.mat-autocomplete-panel') as HTMLElement;
    }));

    it('should scroll to active options below the fold', fakeAsync(() => {
      fixture.componentInstance.trigger._handleKeydown(DOWN_ARROW_EVENT);
      tick();
      fixture.detectChanges();
      expect(container.scrollTop).toBe(0, 'Expected the panel not to scroll.');

      // Press the down arrow five times.
      [1, 2, 3, 4, 5].forEach(() => {
        fixture.componentInstance.trigger._handleKeydown(DOWN_ARROW_EVENT);
        tick();
      });

      // <option bottom> - <panel height> + <2x group labels> = 128
      // 288 - 256 + 96 = 128
      expect(container.scrollTop)
          .toBe(128, 'Expected panel to reveal the sixth option.');
    }));

    it('should scroll to active options on UP arrow', fakeAsync(() => {
      fixture.componentInstance.trigger._handleKeydown(UP_ARROW_EVENT);
      tick();
      fixture.detectChanges();

      // <option bottom> - <panel height> + <3x group label> = 464
      // 576 - 256 + 144 = 464
      expect(container.scrollTop).toBe(464, 'Expected panel to reveal last option.');
    }));

    it('should scroll to active options that are above the panel', fakeAsync(() => {
      fixture.componentInstance.trigger._handleKeydown(DOWN_ARROW_EVENT);
      tick();
      fixture.detectChanges();
      expect(container.scrollTop).toBe(0, 'Expected panel not to scroll.');

      // These down arrows will set the 7th option active, below the fold.
      [1, 2, 3, 4, 5, 6].forEach(() => {
        fixture.componentInstance.trigger._handleKeydown(DOWN_ARROW_EVENT);
        tick();
      });

      // These up arrows will set the 2nd option active
      [5, 4, 3, 2, 1].forEach(() => {
        fixture.componentInstance.trigger._handleKeydown(UP_ARROW_EVENT);
        tick();
      });

      // Expect to show the top of the 2nd option at the top of the panel.
      // It is offset by 48, because there's a group label above it.
      expect(container.scrollTop)
          .toBe(96, 'Expected panel to scroll up when option is above panel.');
    }));
  });

  describe('aria', () => {
    let fixture: ComponentFixture<SimpleAutocomplete>;
    let input: HTMLInputElement;

    beforeEach(() => {
      fixture = TestBed.createComponent(SimpleAutocomplete);
      fixture.detectChanges();

      input = fixture.debugElement.query(By.css('input')).nativeElement;
    });

    it('should set role of input to combobox', () => {
      expect(input.getAttribute('role'))
          .toEqual('combobox', 'Expected role of input to be combobox.');
    });

    it('should set role of autocomplete panel to listbox', () => {
      fixture.componentInstance.trigger.openPanel();
      fixture.detectChanges();

      const panel = fixture.debugElement.query(By.css('.mat-autocomplete-panel')).nativeElement;

      expect(panel.getAttribute('role'))
          .toEqual('listbox', 'Expected role of the panel to be listbox.');
    });

    it('should set aria-autocomplete to list', () => {
      expect(input.getAttribute('aria-autocomplete'))
          .toEqual('list', 'Expected aria-autocomplete attribute to equal list.');
    });

    it('should set aria-multiline to false', () => {
      expect(input.getAttribute('aria-multiline'))
          .toEqual('false', 'Expected aria-multiline attribute to equal false.');
    });

    it('should set aria-activedescendant based on the active option', async(() => {
      fixture.componentInstance.trigger.openPanel();
      fixture.detectChanges();
      fixture.whenStable().then(() => {
        expect(input.hasAttribute('aria-activedescendant'))
            .toBe(false, 'Expected aria-activedescendant to be absent if no active item.');

        const DOWN_ARROW_EVENT = createKeyboardEvent('keydown', DOWN_ARROW);
        fixture.componentInstance.trigger._handleKeydown(DOWN_ARROW_EVENT);

        fixture.whenStable().then(() => {
          fixture.detectChanges();
          expect(input.getAttribute('aria-activedescendant'))
              .toEqual(fixture.componentInstance.options.first.id,
                  'Expected aria-activedescendant to match the active item after 1 down arrow.');

          fixture.componentInstance.trigger._handleKeydown(DOWN_ARROW_EVENT);
          fixture.whenStable().then(() => {
            fixture.detectChanges();

            expect(input.getAttribute('aria-activedescendant'))
                .toEqual(fixture.componentInstance.options.toArray()[1].id,
                    'Expected aria-activedescendant to match the active item after 2 down arrows.');
          });
        });

      });
    }));

    it('should set aria-expanded based on whether the panel is open', async(() => {
      expect(input.getAttribute('aria-expanded'))
          .toBe('false', 'Expected aria-expanded to be false while panel is closed.');

      fixture.componentInstance.trigger.openPanel();
      fixture.whenStable().then(() => {
        fixture.detectChanges();

        expect(input.getAttribute('aria-expanded'))
            .toBe('true', 'Expected aria-expanded to be true while panel is open.');

        fixture.componentInstance.trigger.closePanel();
        fixture.detectChanges();

        fixture.whenStable().then(() => {
          expect(input.getAttribute('aria-expanded'))
              .toBe('false', 'Expected aria-expanded to be false when panel closes again.');
        });
      });
    }));

    it('should set aria-expanded properly when the panel is hidden', async(() => {
        fixture.componentInstance.trigger.openPanel();

        fixture.whenStable().then(() => {
          fixture.detectChanges();
          expect(input.getAttribute('aria-expanded'))
              .toBe('true', 'Expected aria-expanded to be true while panel is open.');

          typeInElement('zz', input);
          fixture.whenStable().then(() => {
            fixture.detectChanges();

            fixture.whenStable().then(() => {
              fixture.detectChanges();
              expect(input.getAttribute('aria-expanded'))
                  .toBe('false', 'Expected aria-expanded to be false when panel hides itself.');
            });
          });
        });
    }));

    it('should set aria-owns based on the attached autocomplete', () => {
      fixture.componentInstance.trigger.openPanel();
      fixture.detectChanges();

      const panel = fixture.debugElement.query(By.css('.mat-autocomplete-panel')).nativeElement;

      expect(input.getAttribute('aria-owns'))
          .toEqual(panel.getAttribute('id'), 'Expected aria-owns to match attached autocomplete.');

    });

    it('should restore focus to the input when clicking to select a value', async(() => {
      fixture.componentInstance.trigger.openPanel();
      fixture.detectChanges();

      fixture.whenStable().then(() => {
        const option = overlayContainerElement.querySelector('md-option') as HTMLElement;

        // Focus the option manually since the synthetic click may not do it.
        option.focus();
        option.click();
        fixture.detectChanges();

        expect(document.activeElement).toBe(input, 'Expected focus to be restored to the input.');
      });
    }));

  });

  describe('Fallback positions', () => {
    let fixture: ComponentFixture<SimpleAutocomplete>;
    let input: HTMLInputElement;
    let inputReference: HTMLInputElement;

    beforeEach(() => {
      fixture = TestBed.createComponent(SimpleAutocomplete);
      fixture.detectChanges();

      input = fixture.debugElement.query(By.css('input')).nativeElement;
      inputReference = fixture.debugElement.query(By.css('.mat-input-flex')).nativeElement;
    });

    it('should use below positioning by default', () => {
      fixture.componentInstance.trigger.openPanel();
      fixture.detectChanges();

      const inputBottom = inputReference.getBoundingClientRect().bottom;
      const panel = overlayContainerElement.querySelector('.mat-autocomplete-panel')!;
      const panelTop = panel.getBoundingClientRect().top;

      expect(Math.floor(inputBottom))
          .toEqual(Math.floor(panelTop), `Expected panel top to match input bottom by default.`);
    });

    it('should reposition the panel on scroll', () => {
      const spacer = document.createElement('div');

      spacer.style.height = '1000px';
      document.body.appendChild(spacer);

      fixture.componentInstance.trigger.openPanel();
      fixture.detectChanges();

      window.scroll(0, 100);
      scrolledSubject.next();
      fixture.detectChanges();

      const inputBottom = inputReference.getBoundingClientRect().bottom;
      const panel = overlayContainerElement.querySelector('.mat-autocomplete-panel')!;
      const panelTop = panel.getBoundingClientRect().top;

      expect(Math.floor(inputBottom)).toEqual(Math.floor(panelTop),
          'Expected panel top to match input bottom after scrolling.');

      document.body.removeChild(spacer);
    });

    it('should fall back to above position if panel cannot fit below', () => {
      // Push the autocomplete trigger down so it won't have room to open "below"
      inputReference.style.top = '600px';
      inputReference.style.position = 'relative';

      fixture.componentInstance.trigger.openPanel();
      fixture.detectChanges();

      const inputTop = inputReference.getBoundingClientRect().top;
      const panel = overlayContainerElement.querySelector('.mat-autocomplete-panel')!;
      const panelBottom = panel.getBoundingClientRect().bottom;

      expect(Math.floor(inputTop))
          .toEqual(Math.floor(panelBottom), `Expected panel to fall back to above position.`);
    });

    it('should align panel properly when filtering in "above" position', async(() => {
      // Push the autocomplete trigger down so it won't have room to open "below"
      inputReference.style.top = '600px';
      inputReference.style.position = 'relative';

      fixture.componentInstance.trigger.openPanel();
      fixture.detectChanges();

      fixture.whenStable().then(() => {
        typeInElement('f', input);
        fixture.detectChanges();

        const inputTop = inputReference.getBoundingClientRect().top;
        const panel = overlayContainerElement.querySelector('.mat-autocomplete-panel')!;
        const panelBottom = panel.getBoundingClientRect().bottom;

        expect(Math.floor(inputTop))
            .toEqual(Math.floor(panelBottom), `Expected panel to stay aligned after filtering.`);
      });
    }));

  });

  describe('Option selection', () => {
    let fixture: ComponentFixture<SimpleAutocomplete>;

    beforeEach(() => {
      fixture = TestBed.createComponent(SimpleAutocomplete);
      fixture.detectChanges();

      fixture.componentInstance.trigger.openPanel();
      fixture.detectChanges();
    });

    it('should deselect any other selected option', async(() => {
      let options =
          overlayContainerElement.querySelectorAll('md-option') as NodeListOf<HTMLElement>;
      options[0].click();
      fixture.detectChanges();

      fixture.whenStable().then(() => {
        fixture.detectChanges();

        let componentOptions = fixture.componentInstance.options.toArray();
        expect(componentOptions[0].selected)
            .toBe(true, `Clicked option should be selected.`);

        options =
            overlayContainerElement.querySelectorAll('md-option') as NodeListOf<HTMLElement>;
        options[1].click();
        fixture.detectChanges();

        expect(componentOptions[0].selected)
            .toBe(false, `Previous option should not be selected.`);
        expect(componentOptions[1].selected)
            .toBe(true, `New Clicked option should be selected.`);

      });
    }));

    it('should call deselect only on the previous selected option', async(() => {
      let options =
          overlayContainerElement.querySelectorAll('md-option') as NodeListOf<HTMLElement>;
      options[0].click();
      fixture.detectChanges();

      fixture.whenStable().then(() => {
        fixture.detectChanges();

        let componentOptions = fixture.componentInstance.options.toArray();
        componentOptions.forEach(option => spyOn(option, 'deselect'));

        expect(componentOptions[0].selected)
            .toBe(true, `Clicked option should be selected.`);

        options =
            overlayContainerElement.querySelectorAll('md-option') as NodeListOf<HTMLElement>;
        options[1].click();
        fixture.detectChanges();

        expect(componentOptions[0].deselect).toHaveBeenCalled();
        componentOptions.slice(1).forEach(option => expect(option.deselect).not.toHaveBeenCalled());
      });
    }));
  });

  describe('without mdInput', () => {
    let fixture: ComponentFixture<AutocompleteWithNativeInput>;

    beforeEach(() => {
      fixture = TestBed.createComponent(AutocompleteWithNativeInput);
      fixture.detectChanges();
    });

    it('should not throw when clicking outside', async(() => {
      dispatchFakeEvent(fixture.debugElement.query(By.css('input')).nativeElement, 'focus');
      fixture.detectChanges();

      fixture.whenStable().then(() => {
        expect(() => dispatchFakeEvent(document, 'click')).not.toThrow();
      });
    }));
  });

  describe('misc', () => {

    it('should allow basic use without any forms directives', () => {
      expect(() => {
        const fixture = TestBed.createComponent(AutocompleteWithoutForms);
        fixture.detectChanges();

        const input = fixture.debugElement.query(By.css('input')).nativeElement;
        typeInElement('d', input);
        fixture.detectChanges();

        const options =
            overlayContainerElement.querySelectorAll('md-option') as NodeListOf<HTMLElement>;
        expect(options.length).toBe(1);
      }).not.toThrowError();
    });

    it('should display an empty input when the value is undefined with ngModel', async(() => {
      const fixture = TestBed.createComponent(AutocompleteWithNgModel);

      fixture.detectChanges();

      fixture.whenStable().then(() => {
        const input = fixture.debugElement.query(By.css('input')).nativeElement;

        expect(input.value).toBe('');
      });
    }));

    it('should display the number when the selected option is the number zero', async(() => {
      const fixture = TestBed.createComponent(AutocompleteWithNumbers);

      fixture.componentInstance.selectedNumber = 0;
      fixture.detectChanges();

      fixture.whenStable().then(() => {
        const input = fixture.debugElement.query(By.css('input')).nativeElement;

        expect(input.value).toBe('0');
      });
    }));

    it('should work when input is wrapped in ngIf', async(() => {
      const fixture = TestBed.createComponent(NgIfAutocomplete);
      fixture.detectChanges();

      const input = fixture.debugElement.query(By.css('input')).nativeElement;
      dispatchFakeEvent(input, 'focusin');

      fixture.whenStable().then(() => {
        fixture.detectChanges();

        expect(fixture.componentInstance.trigger.panelOpen)
            .toBe(true, `Expected panel state to read open when input is focused.`);
        expect(overlayContainerElement.textContent)
            .toContain('One', `Expected panel to display when input is focused.`);
        expect(overlayContainerElement.textContent)
            .toContain('Two', `Expected panel to display when input is focused.`);
      });
    }));

    it('should filter properly with ngIf after setting the active item', fakeAsync(() => {
      const fixture = TestBed.createComponent(NgIfAutocomplete);
      fixture.detectChanges();

      fixture.componentInstance.trigger.openPanel();
      tick();
      fixture.detectChanges();

      const DOWN_ARROW_EVENT = createKeyboardEvent('keydown', DOWN_ARROW);
      fixture.componentInstance.trigger._handleKeydown(DOWN_ARROW_EVENT);
      tick();
      fixture.detectChanges();

      const input = fixture.debugElement.query(By.css('input')).nativeElement;
      typeInElement('o', input);
      fixture.detectChanges();

      expect(fixture.componentInstance.mdOptions.length).toBe(2);
    }));

    it('should throw if the user attempts to open the panel too early', async(() => {
      const fixture = TestBed.createComponent(AutocompleteWithoutPanel);
      fixture.detectChanges();

      expect(() => {
        fixture.componentInstance.trigger.openPanel();
      }).toThrow(getMdAutocompleteMissingPanelError());
    }));

    it('should hide the placeholder with a preselected form control value ' +
      'and a disabled floating placeholder', fakeAsync(() => {
        const fixture = TestBed.createComponent(AutocompleteWithFormsAndNonfloatingPlaceholder);

        fixture.detectChanges();
        tick();
        fixture.detectChanges();

        const input = fixture.nativeElement.querySelector('input');
        const placeholder = fixture.nativeElement.querySelector('.mat-form-field-placeholder');

        expect(input.value).toBe('California');
        expect(placeholder.classList).not.toContain('mat-form-field-empty');
      }));

  });

  it('should have correct width when opened', () => {
    const widthFixture = TestBed.createComponent(SimpleAutocomplete);
    widthFixture.componentInstance.width = 300;
    widthFixture.detectChanges();

    widthFixture.componentInstance.trigger.openPanel();
    widthFixture.detectChanges();

    const overlayPane = overlayContainerElement.querySelector('.cdk-overlay-pane') as HTMLElement;
    // Firefox, edge return a decimal value for width, so we need to parse and round it to verify
    expect(Math.ceil(parseFloat(overlayPane.style.width as string))).toBe(300);

    widthFixture.componentInstance.trigger.closePanel();
    widthFixture.detectChanges();

    widthFixture.componentInstance.width = 500;
    widthFixture.detectChanges();

    widthFixture.componentInstance.trigger.openPanel();
    widthFixture.detectChanges();

    // Firefox, edge return a decimal value for width, so we need to parse and round it to verify
    expect(Math.ceil(parseFloat(overlayPane.style.width as string))).toBe(500);
  });

  it('should update the width while the panel is open', () => {
    const widthFixture = TestBed.createComponent(SimpleAutocomplete);

    widthFixture.componentInstance.width = 300;
    widthFixture.detectChanges();

    widthFixture.componentInstance.trigger.openPanel();
    widthFixture.detectChanges();

    const overlayPane = overlayContainerElement.querySelector('.cdk-overlay-pane') as HTMLElement;
    const input = widthFixture.debugElement.query(By.css('input')).nativeElement;

    expect(Math.ceil(parseFloat(overlayPane.style.width as string))).toBe(300);

    widthFixture.componentInstance.width = 500;
    widthFixture.detectChanges();

    input.focus();
    dispatchFakeEvent(input, 'input');
    widthFixture.detectChanges();

    expect(Math.ceil(parseFloat(overlayPane.style.width as string))).toBe(500);
  });

  it('should show the panel when the options are initialized later within a component with ' +
    'OnPush change detection', fakeAsync(() => {
      let fixture = TestBed.createComponent(AutocompleteWithOnPushDelay);

      fixture.detectChanges();
      dispatchFakeEvent(fixture.debugElement.query(By.css('input')).nativeElement, 'focusin');
      tick(1000);
      fixture.detectChanges();

      Promise.resolve().then(() => {
        let panel = overlayContainerElement.querySelector('.mat-autocomplete-panel') as HTMLElement;
        let visibleClass = 'mat-autocomplete-visible';

        fixture.detectChanges();
        expect(panel.classList).toContain(visibleClass, `Expected panel to be visible.`);
      });
    }));
});

@Component({
  template: `
    <md-form-field [floatPlaceholder]="placeholder" [style.width.px]="width">
      <input mdInput placeholder="State" [mdAutocomplete]="auto" [formControl]="stateCtrl">
    </md-form-field>

    <md-autocomplete #auto="mdAutocomplete" [displayWith]="displayFn">
      <md-option *ngFor="let state of filteredStates" [value]="state">
        <span> {{ state.code }}: {{ state.name }}  </span>
      </md-option>
    </md-autocomplete>
  `
})
class SimpleAutocomplete implements OnDestroy {
  stateCtrl = new FormControl();
  filteredStates: any[];
  valueSub: Subscription;
  placeholder = 'auto';
  width: number;

  @ViewChild(MdAutocompleteTrigger) trigger: MdAutocompleteTrigger;
  @ViewChild(MdAutocomplete) panel: MdAutocomplete;
  @ViewChild(MdFormField) formField: MdFormField;
  @ViewChildren(MdOption) options: QueryList<MdOption>;

  states = [
    {code: 'AL', name: 'Alabama'},
    {code: 'CA', name: 'California'},
    {code: 'FL', name: 'Florida'},
    {code: 'KS', name: 'Kansas'},
    {code: 'MA', name: 'Massachusetts'},
    {code: 'NY', name: 'New York'},
    {code: 'OR', name: 'Oregon'},
    {code: 'PA', name: 'Pennsylvania'},
    {code: 'TN', name: 'Tennessee'},
    {code: 'VA', name: 'Virginia'},
    {code: 'WY', name: 'Wyoming'},
  ];


  constructor() {
    this.filteredStates = this.states;
    this.valueSub = this.stateCtrl.valueChanges.subscribe(val => {
      this.filteredStates = val ? this.states.filter((s) => s.name.match(new RegExp(val, 'gi')))
                                : this.states;
    });
  }

  displayFn(value: any): string {
    return value ? value.name : value;
  }

  ngOnDestroy() {
    this.valueSub.unsubscribe();
  }

}

@Component({
  template: `
    <md-form-field *ngIf="isVisible">
      <input mdInput placeholder="Choose" [mdAutocomplete]="auto" [formControl]="optionCtrl">
    </md-form-field>

    <md-autocomplete #auto="mdAutocomplete">
      <md-option *ngFor="let option of filteredOptions | async" [value]="option">
         {{option}}
      </md-option>
    </md-autocomplete>
  `
})
class NgIfAutocomplete {
  optionCtrl = new FormControl();
  filteredOptions: Observable<any>;
  isVisible = true;
  options = ['One', 'Two', 'Three'];

  @ViewChild(MdAutocompleteTrigger) trigger: MdAutocompleteTrigger;
  @ViewChildren(MdOption) mdOptions: QueryList<MdOption>;

  constructor() {
    this.filteredOptions = RxChain.from(this.optionCtrl.valueChanges)
      .call(startWith, null)
      .call(map, (val: string) => {
        return val ? this.options.filter(option => new RegExp(val, 'gi').test(option))
                   : this.options.slice();
      })
      .result();
  }
}


@Component({
  template: `
    <md-form-field>
      <input mdInput placeholder="State" [mdAutocomplete]="auto"
      (input)="onInput($event.target?.value)">
    </md-form-field>

    <md-autocomplete #auto="mdAutocomplete">
      <md-option *ngFor="let state of filteredStates" [value]="state">
        <span> {{ state }}  </span>
      </md-option>
    </md-autocomplete>
  `
})
class AutocompleteWithoutForms {
  filteredStates: any[];
  states = ['Alabama', 'California', 'Florida'];

  constructor() {
    this.filteredStates = this.states.slice();
  }

  onInput(value: any) {
    this.filteredStates = this.states.filter(s => new RegExp(value, 'gi').test(s));
  }
}


@Component({
  template: `
    <md-form-field>
      <input mdInput placeholder="State" [mdAutocomplete]="auto" [(ngModel)]="selectedState"
      (ngModelChange)="onInput($event)">
    </md-form-field>

    <md-autocomplete #auto="mdAutocomplete">
      <md-option *ngFor="let state of filteredStates" [value]="state">
        <span>{{ state }}</span>
      </md-option>
    </md-autocomplete>
  `
})
class AutocompleteWithNgModel {
  filteredStates: any[];
  selectedState: string;
  states = ['New York', 'Washington', 'Oregon'];

  constructor() {
    this.filteredStates = this.states.slice();
  }

  onInput(value: any) {
    this.filteredStates = this.states.filter(s => new RegExp(value, 'gi').test(s));
  }
}

@Component({
  template: `
    <md-form-field>
      <input mdInput placeholder="Number" [mdAutocomplete]="auto" [(ngModel)]="selectedNumber">
    </md-form-field>

    <md-autocomplete #auto="mdAutocomplete">
      <md-option *ngFor="let number of numbers" [value]="number">
        <span>{{ number }}</span>
      </md-option>
    </md-autocomplete>
  `
})
class AutocompleteWithNumbers {
  selectedNumber: number;
  numbers = [0, 1, 2];
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <md-form-field>
      <input type="text" mdInput [mdAutocomplete]="auto">
    </md-form-field>

    <md-autocomplete #auto="mdAutocomplete">
      <md-option *ngFor="let option of options" [value]="option">{{ option }}</md-option>
    </md-autocomplete>
  `
})
class AutocompleteWithOnPushDelay implements OnInit {
  options: string[];

  ngOnInit() {
    setTimeout(() => {
      this.options = ['One'];
    }, 1000);
  }
}

@Component({
  template: `
    <input placeholder="Choose" [mdAutocomplete]="auto" [formControl]="optionCtrl">

    <md-autocomplete #auto="mdAutocomplete">
      <md-option *ngFor="let option of filteredOptions | async" [value]="option">
         {{option}}
      </md-option>
    </md-autocomplete>
  `
})
class AutocompleteWithNativeInput {
  optionCtrl = new FormControl();
  filteredOptions: Observable<any>;
  options = ['En', 'To', 'Tre', 'Fire', 'Fem'];

  @ViewChild(MdAutocompleteTrigger) trigger: MdAutocompleteTrigger;
  @ViewChildren(MdOption) mdOptions: QueryList<MdOption>;

  constructor() {
    this.filteredOptions = RxChain.from(this.optionCtrl.valueChanges)
      .call(startWith, null)
      .call(map, (val: string) => {
        return val ? this.options.filter(option => new RegExp(val, 'gi').test(option))
                   : this.options.slice();
      })
      .result();
  }
}


@Component({
  template: `<input placeholder="Choose" [mdAutocomplete]="auto">`
})
class AutocompleteWithoutPanel {
  @ViewChild(MdAutocompleteTrigger) trigger: MdAutocompleteTrigger;
}


@Component({
  template: `
    <md-form-field floatPlaceholder="never">
      <input placeholder="State" mdInput [mdAutocomplete]="auto" [formControl]="formControl">
    </md-form-field>

    <md-autocomplete #auto="mdAutocomplete">
      <md-option value="California">California</md-option>
    </md-autocomplete>
  `
})
class AutocompleteWithFormsAndNonfloatingPlaceholder {
  formControl = new FormControl('California');
}


@Component({
  template: `
    <md-input-container>
      <input mdInput placeholder="State" [mdAutocomplete]="auto" [(ngModel)]="selectedState">
    </md-input-container>

    <md-autocomplete #auto="mdAutocomplete">
      <md-optgroup *ngFor="let group of stateGroups" [label]="group.label">
        <md-option *ngFor="let state of group.states" [value]="state">
          <span>{{ state }}</span>
        </md-option>
      </md-optgroup>
    </md-autocomplete>
  `
})
class AutocompleteWithGroups {
  @ViewChild(MdAutocompleteTrigger) trigger: MdAutocompleteTrigger;
  selectedState: string;
  stateGroups = [
    {
      title: 'One',
      states: ['Alabama', 'California', 'Florida', 'Oregon']
    },
    {
      title: 'Two',
      states: ['Kansas', 'Massachusetts', 'New York', 'Pennsylvania']
    },
    {
      title: 'Three',
      states: ['Tennessee', 'Virginia', 'Wyoming', 'Alaska']
    }
  ];
}
