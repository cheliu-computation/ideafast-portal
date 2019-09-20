/// <reference types="cypress" />
const { LOGIN_BODY_ADMIN } = require('../fixtures/loginstring');
const { DELETE_USER, CREATE_USER } = require('../gql/appUsersGql');

describe('User management page', function() {
    it('admin can create user (e2e)', function() {
        /* setup: login via API */
        cy.request('POST', 'http://localhost:3003/graphql', LOGIN_BODY_ADMIN);
        cy.visit('/users');

        /* clicking the create new user button to go to page */
        cy.contains('Create new user', { timeout: 100000 }).click();
        cy.url().should('eq', `${Cypress.config().baseUrl}/users/createNewUser`);

        /* submitting the form */
        const textinputs  = [
            { label: 'Username', value: 'testuser' },
            { label: 'Password', value: 'testpassword' },
            { label: 'Real name', value: 'Test User Chan' },
            { label: 'Organisation', value: 'DSI-ICL' },
            { label: 'Description', value: 'Just a test user.' },
            { label: 'Email', value: 'testing@test.com' },
        ];
        textinputs.forEach(e => {
            cy.get('form').contains(e.label).children('input').type(e.value);
        });
        cy.get('form').contains('Type').children('select').select('System admin');
        cy.contains('Submit').click();

        /* created user should appear in the list of users */
        cy.get('tbody').last().contains('testuser');

        /* the app should redirect to the created user's page */
        cy.url().then(url => {
            expect(url).to.match(new RegExp(`${Cypress.config().baseUrl}/users/(\\w|-)+$`));

            /* cleanup: delete the user via API */
            const createdUserId = url.substring(url.lastIndexOf('/') + 1);
            cy.request('POST', 'http://localhost:3003/graphql', { query: DELETE_USER, variables: { userId: createdUserId } })
                .its('body.data.deleteUser.successful').should('eq', true);
        });
    });

    it.only('admin can navigate to a user\'s detail page from main page', function() {
        /* setup: login via API */
        cy.request('POST', 'http://localhost:3003/graphql', LOGIN_BODY_ADMIN);

        /* setup: create a user via API */
        const createUserInput = {
            username: 'testinguser2',
            password: 'testpassword',
            realName: 'Just Testing Here',
            description: 'No descript',
            organisation: 'DSI',
            email: 'no@n2o.com',
            emailNotificationsActivated: true,
            type: 'STANDARD'
        };
        cy.request('POST', 'http://localhost:3003/graphql',
            { query: CREATE_USER, variables: createUserInput }
        ).then(res => {
            const createdUserId = res.body.data.createUser.id;
            expect(createdUserId).to.be.a('string');

            /* visit user management page */
            cy.visit(`/users`);

            /* find the created user's entry and go to 'more' */
            cy.get('tbody', { timeout: 1000000 }).children().last().within(() => {
                cy.contains('More/Edit').click();
            });

            /* url should have changed */
            cy.url().should('eq', `${Cypress.config().baseUrl}/users/${createdUserId}`);

            /* user detail should have shown up */
            cy.get('div:contains(testinguser2)').should('have.class', 'page_ariane');
            cy.get(':contains(Account Information) + div').within(() => {
                cy.contains('Username');
                cy.contains('Type');
                cy.contains('Real name');
                cy.contains('Password');
                cy.contains('Email');
                cy.contains('Email Notification');
                cy.contains('Description');
                cy.contains('Organisation');
                cy.contains('Created by (readonly)');
            });

            /* cleanup: delete the user via API */
            cy.request('POST', 'http://localhost:3003/graphql', { query: DELETE_USER, variables: { userId: createdUserId } })
                .its('body.data.deleteUser.successful').should('eq', true);
        });
    });

    it('admin can delete user (e2e)', function() {
        /* setup: login via API */
        cy.request('POST', 'http://localhost:3003/graphql', LOGIN_BODY_ADMIN);

        /* setup: create a user via API */
        cy.request('POST', 'http://localhost:3003/graphql',
            {
                query: CREATE_USER,
                variables: {
                    username: 'testinguser',
                    password: 'testpassword',
                    realName: 'Just Testing Here',
                    description: 'No descript',
                    organisation: 'DSI',
                    email: 'no@no.com',
                    emailNotificationsActivated: true,
                    type: 'STANDARD'
                }
            }
        ).then(res => {
            const createUserId = res.body.data.createUser.id;
            expect(createUserId).to.be.a('string');

            /* visit user management page */
            cy.visit(`/users/${createUserId}`);

            /* the protected delete button should not be visible yet */
            cy.contains('Account Information', { timeout: 1000000 });
            cy.contains('Delete user testinguser').should('not.exist');

            /* click the first guard button to delete user */
            cy.get(':contains(Delete this user:) + p:contains(click here)').click();

            /* now this button should be visible */
            cy.contains('Delete user testinguser').click();

            /* user should have feedback */
            cy.contains('User testinguser is deleted');
        });
    }); 
});