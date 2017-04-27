TESTS = test/*.js
REPORTER = spec
TIMEOUT = 20000
MOCHA = ./node_modules/mocha/bin/_mocha
PATH := ./node_modules/.bin:$(PATH)

lint:
	@eslint --fix lib index.js test

test/figures/test.zip: test/figures/code/main.js
	@zip -r $@ -j test/figures/code

figures: test/figures/test.zip
	@unzip -v $^

test: figures
	@mocha -t $(TIMEOUT) -R spec $(TESTS)

test-cov: figures
	@nyc --reporter=html --reporter=text mocha -t $(TIMEOUT) -R spec $(TESTS)

test-coveralls: lint figures
	@nyc mocha -t $(TIMEOUT) -R spec $(TESTS)
	@echo TRAVIS_JOB_ID $(TRAVIS_JOB_ID)
	@nyc report --reporter=text-lcov | coveralls

.PHONY: test
